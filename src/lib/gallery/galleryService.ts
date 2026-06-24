import { query } from '@/lib/db/index'
import { getCategoryBySlug } from '@/lib/files/ensureFilesSeed'
import { fetchFileRow } from '@/lib/files/fileService'
import { FILE_ITEM_FROM, FILE_ITEM_SELECT, rowToFileItem } from '@/lib/files/mapRow'
import type { FileItem } from '@/lib/files/types'
import { GALLERY_SLUG } from '@/lib/files/types'
import { parseCapturedAtInput } from '@/lib/gallery/capturedAt'

export async function getGalleryCategoryId(): Promise<string | null> {
  const row = await getCategoryBySlug(GALLERY_SLUG)
  return (row?.id as string) ?? null
}

export async function listGalleryImages(): Promise<FileItem[]> {
  const categoryId = await getGalleryCategoryId()
  if (!categoryId) return []

  const rows = await query<Record<string, unknown>>(
    `SELECT ${FILE_ITEM_SELECT} ${FILE_ITEM_FROM}
     WHERE f.category_id = $1 AND f.mime_type LIKE 'image/%'
     ORDER BY COALESCE(f.captured_at, f.created_at) DESC, f.created_at DESC`,
    [categoryId],
  )
  return rows.map(rowToFileItem)
}

export async function findFileByContentHash(
  categoryId: string,
  contentHash: string,
): Promise<FileItem | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT ${FILE_ITEM_SELECT} ${FILE_ITEM_FROM}
     WHERE f.category_id = $1 AND f.content_hash = $2
     LIMIT 1`,
    [categoryId, contentHash],
  )
  return rows[0] ? rowToFileItem(rows[0]) : null
}

export async function findExistingHashes(
  categoryId: string,
  hashes: string[],
): Promise<Record<string, FileItem>> {
  const unique = [...new Set(hashes.filter(Boolean))]
  if (!unique.length) return {}

  const rows = await query<Record<string, unknown>>(
    `SELECT ${FILE_ITEM_SELECT} ${FILE_ITEM_FROM}
     WHERE f.category_id = $1 AND f.content_hash = ANY($2::char(64)[])`,
    [categoryId, unique],
  )

  const out: Record<string, FileItem> = {}
  for (const row of rows) {
    const item = rowToFileItem(row)
    if (item.contentHash) out[item.contentHash] = item
  }
  return out
}

export async function setGalleryCapturedAt(
  fileId: string,
  capturedAtRaw: string,
): Promise<FileItem> {
  const row = await fetchFileRow(fileId)
  if (!row) throw new Error('Файл не найден')
  if ((row.category_slug as string) !== GALLERY_SLUG) {
    throw new Error('Дату съёмки можно менять только в галерее')
  }
  if (!String(row.mime_type).startsWith('image/')) {
    throw new Error('Только для фотографий')
  }

  const capturedAt = parseCapturedAtInput(capturedAtRaw)
  if (!capturedAt) throw new Error('Некорректная дата')

  await query(
    'UPDATE file_items SET captured_at = $1, updated_at = NOW() WHERE id = $2',
    [capturedAt.toISOString(), fileId],
  )

  const updated = await fetchFileRow(fileId)
  if (!updated) throw new Error('Файл не найден')
  return rowToFileItem(updated)
}
