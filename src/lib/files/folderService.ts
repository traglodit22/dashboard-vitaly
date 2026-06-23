import { randomUUID } from 'crypto'
import { query } from '@/lib/db/index'
import type { FileStorageType } from '@/lib/files/types'
import { FOLDER_KEEP_NAME } from '@/lib/files/types'
import { rowToFileFolder } from '@/lib/files/mapRow'
import { ensureLocalFolder, removeLocalFolderKeep } from '@/lib/files/localStorage'

export async function getFolderStoragePrefix(folderId: string): Promise<string> {
  const parts: string[] = []
  let currentId: string | null = folderId

  while (currentId) {
    const rows: { id: string; parent_id: string | null }[] = await query(
      'SELECT id, parent_id FROM file_folders WHERE id = $1',
      [currentId],
    )
    const row = rows[0]
    if (!row) break
    parts.unshift(row.id)
    currentId = row.parent_id
  }

  return parts.join('/')
}

export async function listFolders(categoryId: string, parentId: string | null) {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM file_folders
     WHERE category_id = $1 AND parent_id IS NOT DISTINCT FROM $2
     ORDER BY sort_order ASC, name ASC`,
    [categoryId, parentId],
  )
  return rows.map(rowToFileFolder)
}

export async function listAllFolders(categoryId: string) {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM file_folders
     WHERE category_id = $1
     ORDER BY sort_order ASC, name ASC`,
    [categoryId],
  )
  return rows.map(rowToFileFolder)
}

export async function createFolder(opts: {
  categoryId: string
  categorySlug: string
  storageType: FileStorageType
  parentId: string | null
  name: string
}) {
  const trimmed = opts.name.trim()
  if (!trimmed) throw new Error('Укажите название папки')
  if (trimmed.length > 120) throw new Error('Слишком длинное название')

  const dup = await query<{ id: string }>(
    `SELECT id FROM file_folders
     WHERE category_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND lower(name) = lower($3)`,
    [opts.categoryId, opts.parentId, trimmed],
  )
  if (dup.length) throw new Error('Папка с таким названием уже есть')

  const [{ next_order }] = await query<{ next_order: string }>(
    `SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order
     FROM file_folders
     WHERE category_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
    [opts.categoryId, opts.parentId],
  )

  const id = randomUUID()
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO file_folders (id, category_id, parent_id, name, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, opts.categoryId, opts.parentId, trimmed, Number(next_order)],
  )

  const prefix =
    opts.storageType !== 'gcs' ? await getFolderStoragePrefix(id) : ''

  if (opts.storageType !== 'gcs') {
    await ensureLocalFolder(opts.categorySlug, prefix)
  }

  return rowToFileFolder(rows[0])
}

export async function deleteFolder(folderId: string): Promise<void> {
  const [{ count: subCount }] = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM file_folders WHERE parent_id = $1',
    [folderId],
  )
  if (Number(subCount) > 0) {
    throw new Error('Сначала удалите вложенные папки')
  }

  const [{ count: fileCount }] = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM file_items WHERE folder_id = $1',
    [folderId],
  )
  if (Number(fileCount) > 0) {
    throw new Error('Сначала удалите файлы в папке')
  }

  const rows = await query<{
    id: string
    category_id: string
    parent_id: string | null
  }>('SELECT id, category_id FROM file_folders WHERE id = $1', [folderId])
  const folder = rows[0]
  if (!folder) throw new Error('Папка не найдена')

  const catRows = await query<{ slug: string; storage_type: string }>(
    'SELECT slug, storage_type FROM file_categories WHERE id = $1',
    [folder.category_id],
  )
  const cat = catRows[0]
  if (!cat) throw new Error('Категория не найдена')

  await query('DELETE FROM file_folders WHERE id = $1', [folderId])

  if (cat.storage_type !== 'gcs') {
    const prefix = await getFolderStoragePrefix(folderId)
    await removeLocalFolderKeep(cat.slug, prefix)
  }
}

export async function renameFolder(folderId: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Укажите название папки')
  if (trimmed.length > 120) throw new Error('Слишком длинное название')

  const existing = await query<{ id: string; category_id: string; parent_id: string | null }>(
    'SELECT id, category_id, parent_id FROM file_folders WHERE id = $1',
    [folderId],
  )
  const folder = existing[0]
  if (!folder) throw new Error('Папка не найдена')

  const dup = await query<{ id: string }>(
    `SELECT id FROM file_folders
     WHERE category_id = $1 AND parent_id IS NOT DISTINCT FROM $2
       AND lower(name) = lower($3) AND id <> $4`,
    [folder.category_id, folder.parent_id, trimmed, folderId],
  )
  if (dup.length) throw new Error('Папка с таким названием уже есть')

  const rows = await query<Record<string, unknown>>(
    `UPDATE file_folders SET name = $1 WHERE id = $2 RETURNING *`,
    [trimmed, folderId],
  )
  return rowToFileFolder(rows[0])
}

export async function getFolderBreadcrumb(folderId: string | null) {
  if (!folderId) return []

  const trail: { id: string; name: string }[] = []
  let currentId: string | null = folderId

  while (currentId) {
    const rows: { id: string; name: string; parent_id: string | null }[] = await query(
      'SELECT id, name, parent_id FROM file_folders WHERE id = $1',
      [currentId],
    )
    const row = rows[0]
    if (!row) break
    trail.unshift({ id: row.id, name: row.name })
    currentId = row.parent_id
  }

  return trail
}
