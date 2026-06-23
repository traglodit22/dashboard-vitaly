import { randomUUID } from 'crypto'
import { query } from '@/lib/db/index'
import { buildFilePreview } from '@/lib/files/pdfPreview'
import {
  deleteFromGcs,
  downloadFromGcs,
  gcsObjectKey,
  gcsPreviewKey,
  getGcsUploadSignedUrl,
  isGcsConfigured,
  uploadToGcs,
} from '@/lib/files/gcsStorage'
import { getFolderStoragePrefix } from '@/lib/files/folderService'
import {
  deleteLocalRelative,
  extForMime,
  readLocalRelative,
  saveLocalFile,
  saveLocalPreview,
} from '@/lib/files/localStorage'
import { FILE_ITEM_FROM, FILE_ITEM_SELECT, rowToFileItem } from '@/lib/files/mapRow'
import { isImageMime } from '@/lib/files/mimeDetect'
import type { FileStorageType } from '@/lib/files/types'
import { MAX_FILE_BYTES } from '@/lib/files/types'

async function nextFileSortOrder(categoryId: string, folderId: string | null): Promise<number> {
  const rows = await query<{ next_order: string }>(
    `SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order
     FROM file_items
     WHERE category_id = $1 AND folder_id IS NOT DISTINCT FROM $2`,
    [categoryId, folderId],
  )
  return Number(rows[0]?.next_order ?? 10)
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
}) {
  const id = randomUUID()
  const ext = extForMime(opts.mime)
  const folderPrefix = opts.folderId ? await getFolderStoragePrefix(opts.folderId) : ''
  let storagePath: string
  let previewPath: string | null = null

  // Превью PDF/картинок для локальных файлов при загрузке; для GCS — лениво через GET /preview.
  const previewBuffer =
    opts.storageType !== 'gcs' ? await buildFilePreview(opts.mime, opts.buffer) : null

  if (opts.storageType === 'gcs') {
    if (!isGcsConfigured()) {
      throw new Error('Google Cloud Storage не настроен на сервере')
    }
    storagePath = gcsObjectKey(opts.categorySlug, folderPrefix, id, ext)
    await uploadToGcs(storagePath, opts.buffer, opts.mime)
    // Превью для картинок в облаке — оригинал (lazy через /preview).
    if (isImageMime(opts.mime)) {
      previewPath = storagePath
    }
  } else {
    const saved = await saveLocalFile(
      opts.categorySlug,
      folderPrefix,
      id,
      opts.buffer,
      opts.mime,
    )
    storagePath = saved.storagePath
    if (previewBuffer) {
      previewPath = await saveLocalPreview(opts.categorySlug, folderPrefix, id, previewBuffer)
    } else if (opts.mime.startsWith('image/')) {
      previewPath = storagePath
    }
  }

  const rows = await query<Record<string, unknown>>(
    `INSERT INTO file_items
      (id, category_id, folder_id, title, original_name, mime_type, size_bytes, storage_path, preview_path, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
    ],
  )

  return fetchFileItem(rows[0].id as string)
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
    throw new Error('Максимальный размер файла — 20 МБ')
  }

  const fileId = randomUUID()
  const ext = extForMime(opts.mime)
  const folderPrefix = opts.folderId ? await getFolderStoragePrefix(opts.folderId) : ''
  const storagePath = gcsObjectKey(opts.categorySlug, folderPrefix, fileId, ext)
  const uploadUrl = await getGcsUploadSignedUrl(storagePath, opts.mime)

  return { fileId, uploadUrl, storagePath, mime: opts.mime }
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
}) {
  const ext = extForMime(opts.mime)
  const folderPrefix = opts.folderId ? await getFolderStoragePrefix(opts.folderId) : ''
  const storagePath = gcsObjectKey(opts.categorySlug, folderPrefix, opts.fileId, ext)
  const previewPath = isImageMime(opts.mime) ? storagePath : null

  const rows = await query<Record<string, unknown>>(
    `INSERT INTO file_items
      (id, category_id, folder_id, title, original_name, mime_type, size_bytes, storage_path, preview_path, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
    ],
  )

  return fetchFileItem(rows[0].id as string)
}

export async function readFileContent(row: Record<string, unknown>): Promise<Buffer> {
  const storageType = row.category_storage_type as string
  const storagePath = row.storage_path as string
  if (storageType === 'gcs') return downloadFromGcs(storagePath)
  return readLocalRelative(storagePath)
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

/** Сгенерировать и сохранить превью, если его ещё нет (в т.ч. для уже загруженных PDF). */
export async function ensureFilePreview(row: Record<string, unknown>): Promise<Buffer | null> {
  const existing = await readFilePreview(row)
  if (existing) return existing

  const mime = row.mime_type as string
  const storageType = row.category_storage_type as string
  const categorySlug = row.category_slug as string
  const fileId = row.id as string
  const folderId = (row.folder_id as string) ?? null

  if (mime !== 'application/pdf' && !mime.startsWith('image/')) return null

  const content = await readFileContent(row)
  const folderPrefix = folderId ? await getFolderStoragePrefix(folderId) : ''
  const fileStoragePath = row.storage_path as string

  if (storageType === 'gcs' && mime.startsWith('image/')) {
    await query(
      'UPDATE file_items SET preview_path = $1, updated_at = NOW() WHERE id = $2',
      [fileStoragePath, fileId],
    )
    return content
  }

  const previewBuffer = await buildFilePreview(mime, content)
  if (!previewBuffer) {
    return mime.startsWith('image/') ? content : null
  }

  let previewPath: string

  if (storageType === 'gcs') {
    if (!isGcsConfigured()) return previewBuffer
    previewPath = gcsPreviewKey(categorySlug, folderPrefix, fileId)
    await uploadToGcs(previewPath, previewBuffer, 'image/webp')
  } else {
    previewPath = await saveLocalPreview(categorySlug, folderPrefix, fileId, previewBuffer)
  }

  await query(
    'UPDATE file_items SET preview_path = $1, updated_at = NOW() WHERE id = $2',
    [previewPath, fileId],
  )

  return previewBuffer
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
