import { randomUUID } from 'crypto'
import { query } from '@/lib/db/index'
import { buildFilePreview } from '@/lib/files/pdfPreview'
import {
  deleteFromGcs,
  downloadFromGcs,
  gcsObjectKey,
  gcsPreviewKey,
  getGcsReadSignedUrl,
  getGcsUploadSignedUrl,
  isGcsConfigured,
  uploadToGcs,
} from '@/lib/files/gcsStorage'
import { getFolderStoragePrefix } from '@/lib/files/folderService'
import {
  deleteLocalRelative,
  extForMime,
  localAbsolutePath,
  readLocalRelative,
  saveLocalFile,
  saveLocalPreview,
  writeLocalRelative,
} from '@/lib/files/localStorage'
import { FILE_ITEM_FROM, FILE_ITEM_SELECT, rowToFileItem } from '@/lib/files/mapRow'
import { isImageMime, isPdfMime, isTextMime, isVideoMime } from '@/lib/files/mimeDetect'
import type { FileStorageType } from '@/lib/files/types'
import { isThumbnailPreviewPath, PREVIEW_MAX_SOURCE_BYTES } from '@/lib/files/previewConstants'
import { renderVideoPreview } from '@/lib/files/videoPreview'
import { dropCachedPreview } from '@/lib/files/previewMemoryCache'
import { findFileByContentHash } from '@/lib/gallery/galleryService'
import { analyzeImageBuffer } from '@/lib/gallery/imageMeta'
import { MAX_FILE_BYTES, MAX_FILE_SIZE_ERROR } from '@/lib/files/types'

async function nextFileSortOrder(categoryId: string, folderId: string | null): Promise<number> {
  const rows = await query<{ next_order: string }>(
    `SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order
     FROM file_items
     WHERE category_id = $1 AND folder_id IS NOT DISTINCT FROM $2`,
    [categoryId, folderId],
  )
  return Number(rows[0]?.next_order ?? 10)
}

async function buildUploadPreview(
  mime: string,
  buffer: Buffer,
  originalName: string,
): Promise<Buffer | null> {
  if (isVideoMime(mime, originalName)) return null
  if (!isImageMime(mime) && !isPdfMime(mime, originalName)) return null
  return buildFilePreview(mime, buffer, originalName)
}

async function persistPreviewForUpload(opts: {
  storageType: FileStorageType
  categorySlug: string
  folderPrefix: string
  fileId: string
  mime: string
  buffer: Buffer
  originalName: string
}): Promise<string | null> {
  const thumb = await buildUploadPreview(opts.mime, opts.buffer, opts.originalName)
  if (!thumb) return null

  if (opts.storageType === 'gcs') {
    const previewPath = gcsPreviewKey(opts.categorySlug, opts.folderPrefix, opts.fileId)
    await uploadToGcs(previewPath, thumb, 'image/webp')
    return previewPath
  }
  return saveLocalPreview(opts.categorySlug, opts.folderPrefix, opts.fileId, thumb)
}

export async function fetchFileItem(id: string) {
  const rows = await query<Record<string, unknown>>(
    `SELECT ${FILE_ITEM_SELECT} ${FILE_ITEM_FROM} WHERE f.id = $1`,
    [id],
  )
  return rows[0] ? rowToFileItem(rows[0]) : null
}

export async function uploadFileItem(opts: {
  categoryId: string
  categorySlug: string
  storageType: FileStorageType
  folderId: string | null
  title: string
  originalName: string
  mime: string
  buffer: Buffer
  contentHash?: string | null
  capturedAt?: Date | string | null
}) {
  let contentHash = opts.contentHash ?? null
  let capturedAt = opts.capturedAt
    ? opts.capturedAt instanceof Date
      ? opts.capturedAt
      : new Date(opts.capturedAt)
    : null
  if (!contentHash && opts.mime.startsWith('image/')) {
    const meta = await analyzeImageBuffer(opts.buffer, opts.mime)
    contentHash = meta.contentHash
    if (!capturedAt) capturedAt = meta.capturedAt
  }

  if (contentHash) {
    const existing = await findFileByContentHash(opts.categoryId, contentHash)
    if (existing) return { item: existing, duplicate: true as const }
  }

  const id = randomUUID()
  const ext = extForMime(opts.mime)
  const folderPrefix = opts.folderId ? await getFolderStoragePrefix(opts.folderId) : ''
  let storagePath: string
  let previewPath: string | null = null

  if (opts.storageType === 'gcs') {
    if (!isGcsConfigured()) {
      throw new Error('Google Cloud Storage не настроен на сервере')
    }
    storagePath = gcsObjectKey(opts.categorySlug, folderPrefix, id, ext)
    await uploadToGcs(storagePath, opts.buffer, opts.mime)
    previewPath = await persistPreviewForUpload({
      storageType: 'gcs',
      categorySlug: opts.categorySlug,
      folderPrefix,
      fileId: id,
      mime: opts.mime,
      buffer: opts.buffer,
      originalName: opts.originalName,
    })
  } else {
    const saved = await saveLocalFile(
      opts.categorySlug,
      folderPrefix,
      id,
      opts.buffer,
      opts.mime,
    )
    storagePath = saved.storagePath
    previewPath = await persistPreviewForUpload({
      storageType: 'local',
      categorySlug: opts.categorySlug,
      folderPrefix,
      fileId: id,
      mime: opts.mime,
      buffer: opts.buffer,
      originalName: opts.originalName,
    })
  }

  const rows = await query<Record<string, unknown>>(
    `INSERT INTO file_items
      (id, category_id, folder_id, title, original_name, mime_type, size_bytes, storage_path, preview_path, sort_order, content_hash, captured_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      id,
      opts.categoryId,
      opts.folderId,
      opts.title,
      opts.originalName,
      opts.mime,
      opts.buffer.length,
      storagePath,
      previewPath,
      await nextFileSortOrder(opts.categoryId, opts.folderId),
      contentHash,
      capturedAt,
    ],
  )

  const item = await fetchFileItem(rows[0].id as string)
  if (!item) throw new Error('Не удалось сохранить файл')
  return { item, duplicate: false as const }
}

export async function prepareGcsDirectUpload(opts: {
  categorySlug: string
  folderId: string | null
  originalName: string
  mime: string
  sizeBytes: number
}) {
  if (!isGcsConfigured()) {
    throw new Error('Google Cloud Storage не настроен на сервере')
  }
  if (opts.sizeBytes > MAX_FILE_BYTES) {
    throw new Error(MAX_FILE_SIZE_ERROR)
  }

  const fileId = randomUUID()
  const ext = extForMime(opts.mime)
  const folderPrefix = opts.folderId ? await getFolderStoragePrefix(opts.folderId) : ''
  const storagePath = gcsObjectKey(opts.categorySlug, folderPrefix, fileId, ext)
  const uploadUrl = await getGcsUploadSignedUrl(storagePath, opts.mime)

  return { fileId, uploadUrl, storagePath, mime: opts.mime }
}

/** Повторно выдаёт signed URL для уже подготовленной загрузки (тот же fileId и путь в GCS). */
export async function getGcsSignedUrlForPreparedFile(opts: {
  fileId: string
  categorySlug: string
  folderId: string | null
  mime: string
}) {
  const ext = extForMime(opts.mime)
  const folderPrefix = opts.folderId ? await getFolderStoragePrefix(opts.folderId) : ''
  const storagePath = gcsObjectKey(opts.categorySlug, folderPrefix, opts.fileId, ext)
  return getGcsUploadSignedUrl(storagePath, opts.mime)
}

export async function completeGcsDirectUpload(opts: {
  fileId: string
  categoryId: string
  categorySlug: string
  folderId: string | null
  title: string
  originalName: string
  mime: string
  sizeBytes: number
  contentHash?: string | null
  capturedAt?: Date | string | null
}) {
  const ext = extForMime(opts.mime)
  const folderPrefix = opts.folderId ? await getFolderStoragePrefix(opts.folderId) : ''
  const storagePath = gcsObjectKey(opts.categorySlug, folderPrefix, opts.fileId, ext)

  let contentHash = opts.contentHash ?? null
  let capturedAt = opts.capturedAt
    ? opts.capturedAt instanceof Date
      ? opts.capturedAt
      : new Date(opts.capturedAt)
    : null

  const HASH_MAX_BYTES = 12 * 1024 * 1024
  let downloadedBuffer: Buffer | null = null
  if (!contentHash && opts.mime.startsWith('image/') && opts.sizeBytes <= HASH_MAX_BYTES) {
    try {
      downloadedBuffer = await downloadFromGcs(storagePath)
      const meta = await analyzeImageBuffer(downloadedBuffer, opts.mime)
      contentHash = meta.contentHash
      if (!capturedAt) capturedAt = meta.capturedAt
    } catch (err) {
      console.error('[files] gallery meta from GCS failed', err)
    }
  }

  if (contentHash) {
    const existing = await findFileByContentHash(opts.categoryId, contentHash)
    if (existing) {
      try {
        await deleteFromGcs(storagePath)
      } catch {
        /* orphan object */
      }
      return { item: existing, duplicate: true as const }
    }
  }

  let previewPath: string | null = null
  if (
    downloadedBuffer &&
    (isImageMime(opts.mime) || isPdfMime(opts.mime, opts.originalName))
  ) {
    try {
      previewPath = await persistPreviewForUpload({
        storageType: 'gcs',
        categorySlug: opts.categorySlug,
        folderPrefix,
        fileId: opts.fileId,
        mime: opts.mime,
        buffer: downloadedBuffer,
        originalName: opts.originalName,
      })
    } catch (err) {
      console.error('[files] inline preview after GCS upload failed', err)
    }
  }

  const rows = await query<Record<string, unknown>>(
    `INSERT INTO file_items
      (id, category_id, folder_id, title, original_name, mime_type, size_bytes, storage_path, preview_path, sort_order, content_hash, captured_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      opts.fileId,
      opts.categoryId,
      opts.folderId,
      opts.title,
      opts.originalName,
      opts.mime,
      opts.sizeBytes,
      storagePath,
      previewPath,
      await nextFileSortOrder(opts.categoryId, opts.folderId),
      contentHash,
      capturedAt,
    ],
  )

  const item = await fetchFileItem(rows[0].id as string)
  if (!item) throw new Error('Не удалось сохранить файл')
  return { item, duplicate: false as const }
}

export async function readFileContent(row: Record<string, unknown>): Promise<Buffer> {
  const storageType = row.category_storage_type as string
  const storagePath = row.storage_path as string
  if (storageType === 'gcs') return downloadFromGcs(storagePath)
  return readLocalRelative(storagePath)
}

export async function writeFileContent(
  row: Record<string, unknown>,
  buffer: Buffer,
): Promise<void> {
  const mime = row.mime_type as string
  if (!isTextMime(mime)) {
    throw new Error('Редактировать можно только текстовые заметки')
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(MAX_FILE_SIZE_ERROR)
  }

  const storageType = row.category_storage_type as string
  const storagePath = row.storage_path as string

  if (storageType === 'gcs') {
    await uploadToGcs(storagePath, buffer, mime)
  } else {
    await writeLocalRelative(storagePath, buffer)
  }

  await query(
    'UPDATE file_items SET size_bytes = $1, updated_at = NOW() WHERE id = $2',
    [buffer.length, row.id as string],
  )
}

export async function createTextNoteItem(opts: {
  categoryId: string
  categorySlug: string
  storageType: FileStorageType
  folderId: string | null
  title: string
  content: string
}) {
  const title = opts.title.trim()
  if (!title) throw new Error('Укажите название заметки')

  const buffer = Buffer.from(opts.content, 'utf8')
  const originalName = `${title}.txt`

  return uploadFileItem({
    categoryId: opts.categoryId,
    categorySlug: opts.categorySlug,
    storageType: opts.storageType,
    folderId: opts.folderId,
    title,
    originalName,
    mime: 'text/plain',
    buffer,
  })
}

export async function readFilePreview(row: Record<string, unknown>): Promise<Buffer | null> {
  const previewPath = row.preview_path as string | null
  if (!previewPath) return null
  const storageType = row.category_storage_type as string
  try {
    if (storageType === 'gcs') return await downloadFromGcs(previewPath)
    return await readLocalRelative(previewPath)
  } catch {
    return null
  }
}

/** Сгенерировать и сохранить WebP-превью (~320px), если его ещё нет. */
export async function ensureFilePreview(row: Record<string, unknown>): Promise<Buffer | null> {
  const previewPath = row.preview_path as string | null
  const storagePath = row.storage_path as string
  const mime = row.mime_type as string
  const originalName = row.original_name as string
  const isVideo = isVideoMime(mime, originalName)

  if (!isPdfMime(mime, originalName) && !mime.startsWith('image/') && !isVideo) return null

  const sizeBytes = Number(row.size_bytes ?? 0)
  if (!isVideo && sizeBytes > PREVIEW_MAX_SOURCE_BYTES) return null

  if (isThumbnailPreviewPath(previewPath, storagePath)) {
    const existing = await readFilePreview(row)
    if (existing) return existing
  }

  let previewBuffer: Buffer | null
  if (isVideo) {
    const storageType = row.category_storage_type as string
    const source =
      storageType === 'gcs'
        ? await getGcsReadSignedUrl(storagePath)
        : localAbsolutePath(storagePath)
    previewBuffer = await renderVideoPreview(source)
  } else {
    const content = await readFileContent(row)
    previewBuffer = await buildFilePreview(mime, content, originalName)
  }

  if (!previewBuffer) {
    console.error('[files] preview generation returned null', {
      fileId: row.id,
      mime,
      originalName,
      storageType: row.category_storage_type,
    })
    return null
  }

  await persistFilePreview(row, previewBuffer)
  return previewBuffer
}

async function persistFilePreview(
  row: Record<string, unknown>,
  previewBuffer: Buffer,
): Promise<string> {
  const storageType = row.category_storage_type as string
  const categorySlug = row.category_slug as string
  const fileId = row.id as string
  const folderId = (row.folder_id as string) ?? null
  const folderPrefix = folderId ? await getFolderStoragePrefix(folderId) : ''

  let previewPath: string
  if (storageType === 'gcs') {
    if (!isGcsConfigured()) throw new Error('Google Cloud Storage не настроен')
    previewPath = gcsPreviewKey(categorySlug, folderPrefix, fileId)
    await uploadToGcs(previewPath, previewBuffer, 'image/webp')
  } else {
    previewPath = await saveLocalPreview(categorySlug, folderPrefix, fileId, previewBuffer)
  }

  await query(
    'UPDATE file_items SET preview_path = $1, updated_at = NOW() WHERE id = $2',
    [previewPath, fileId],
  )
  dropCachedPreview(fileId)
  return previewPath
}

export async function deleteFileItem(row: Record<string, unknown>): Promise<void> {
  const storageType = row.category_storage_type as string
  const storagePath = row.storage_path as string
  const previewPath = row.preview_path as string | null

  if (storageType === 'gcs') {
    await deleteFromGcs(storagePath)
    if (previewPath && previewPath !== storagePath) {
      await deleteFromGcs(previewPath)
    }
  } else {
    await deleteLocalRelative(storagePath)
    if (previewPath && previewPath !== storagePath) {
      await deleteLocalRelative(previewPath)
    }
  }

  await query('DELETE FROM file_items WHERE id = $1', [row.id as string])
}

export async function fetchFileRow(id: string) {
  const rows = await query<Record<string, unknown>>(
    `SELECT ${FILE_ITEM_SELECT} ${FILE_ITEM_FROM} WHERE f.id = $1`,
    [id],
  )
  return rows[0] ?? null
}
