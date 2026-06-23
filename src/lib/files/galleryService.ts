import { query } from '@/lib/db/index'
import { fetchFileRow } from '@/lib/files/fileService'
import { rowToFileItem } from '@/lib/files/mapRow'
import { isImageMime } from '@/lib/files/mimeDetect'

async function nextGallerySortOrder(folderId: string): Promise<number> {
  const rows = await query<{ next_order: string }>(
    `SELECT COALESCE(MAX(gallery_sort_order), 0) + 10 AS next_order
     FROM file_items WHERE folder_id = $1 AND in_gallery = true`,
    [folderId],
  )
  return Number(rows[0]?.next_order ?? 10)
}

export async function setItemInGallery(fileId: string, inGallery: boolean) {
  const row = await fetchFileRow(fileId)
  if (!row) throw new Error('Файл не найден')
  if (row.category_storage_type !== 'gcs') {
    throw new Error('Галерея доступна только в облаке')
  }
  if (!isImageMime(row.mime_type as string)) {
    throw new Error('В галерею можно добавлять только фото')
  }
  const folderId = row.folder_id as string | null
  if (!folderId) throw new Error('Файл не в папке')

  if (inGallery) {
    const order = await nextGallerySortOrder(folderId)
    await query(
      `UPDATE file_items
       SET in_gallery = true, gallery_sort_order = $1, updated_at = NOW()
       WHERE id = $2`,
      [order, fileId],
    )
  } else {
    await query(
      `UPDATE file_items SET in_gallery = false, updated_at = NOW() WHERE id = $1`,
      [fileId],
    )
  }

  const updated = await fetchFileRow(fileId)
  if (!updated) throw new Error('Файл не найден')
  return rowToFileItem(updated)
}
