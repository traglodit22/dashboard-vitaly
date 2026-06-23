import { randomUUID } from 'crypto'
import { query } from '@/lib/db/index'
import { buildFilePreview } from '@/lib/files/pdfPreview'
import {
  deleteFromGcs,
  downloadFromGcs,
  gcsObjectKey,
  gcsPreviewKey,
  isGcsConfigured,
  uploadToGcs,
} from '@/lib/files/gcsStorage'
import {
  deleteLocalFiles,
  extForMime,
  readLocalRelative,
  saveLocalFile,
  saveLocalPreview,
} from '@/lib/files/localStorage'
import { FILE_ITEM_FROM, FILE_ITEM_SELECT, rowToFileItem } from '@/lib/files/mapRow'
import type { FileStorageType } from '@/lib/files/types'

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
  title: string
  originalName: string
  mime: string
  buffer: Buffer
}) {
  const id = randomUUID()
  const ext = extForMime(opts.mime)
  let storagePath: string
  let previewPath: string | null = null

  const previewBuffer = await buildFilePreview(opts.mime, opts.buffer)

  if (opts.storageType === 'gcs') {
    if (!isGcsConfigured()) {
      throw new Error('Google Cloud Storage не настроен на сервере')
    }
    storagePath = gcsObjectKey(opts.categorySlug, id, ext)
    await uploadToGcs(storagePath, opts.buffer, opts.mime)
    if (previewBuffer) {
      previewPath = gcsPreviewKey(opts.categorySlug, id)
      await uploadToGcs(previewPath, previewBuffer, 'image/webp')
    }
  } else {
    const saved = await saveLocalFile(opts.categorySlug, id, opts.buffer, opts.mime)
    storagePath = saved.storagePath
    if (previewBuffer) {
      previewPath = await saveLocalPreview(opts.categorySlug, id, previewBuffer)
    } else if (opts.mime.startsWith('image/')) {
      previewPath = storagePath
    }
  }

  const rows = await query<Record<string, unknown>>(
    `INSERT INTO file_items
      (id, category_id, title, original_name, mime_type, size_bytes, storage_path, preview_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      id,
      opts.categoryId,
      opts.title,
      opts.originalName,
      opts.mime,
      opts.buffer.length,
      storagePath,
      previewPath,
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
  if (storageType === 'gcs') return downloadFromGcs(previewPath)
  return readLocalRelative(previewPath)
}

export async function deleteFileItem(row: Record<string, unknown>): Promise<void> {
  const id = row.id as string
  const storageType = row.category_storage_type as string
  const categorySlug = row.category_slug as string
  const storagePath = row.storage_path as string
  const previewPath = row.preview_path as string | null
  const mime = row.mime_type as string
  const ext = extForMime(mime)

  if (storageType === 'gcs') {
    await deleteFromGcs(storagePath)
    if (previewPath && previewPath !== storagePath) {
      await deleteFromGcs(previewPath)
    }
  } else {
    await deleteLocalFiles(categorySlug, id, ext, Boolean(previewPath && previewPath !== storagePath))
  }

  await query('DELETE FROM file_items WHERE id = $1', [id])
}

export async function fetchFileRow(id: string) {
  const rows = await query<Record<string, unknown>>(
    `SELECT ${FILE_ITEM_SELECT} ${FILE_ITEM_FROM} WHERE f.id = $1`,
    [id],
  )
  return rows[0] ?? null
}
