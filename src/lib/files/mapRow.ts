import type { FileCategory, FileFolder, FileItem, FileStorageType } from '@/lib/files/types'
import { isThumbnailPreviewPath } from '@/lib/files/previewConstants'

function rowTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return String(value ?? '')
}

export function rowToFileCategory(row: Record<string, unknown>): FileCategory {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    storageType: parseStorageType(row.storage_type),
    sortOrder: Number(row.sort_order ?? 0),
  }
}

export function rowToFileFolder(row: Record<string, unknown>): FileFolder {
  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    parentId: (row.parent_id as string) ?? null,
    name: row.name as string,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: (row.created_at as string) ?? '',
    moduleTextEnabled: Boolean(row.module_text_enabled),
    moduleGalleryEnabled: Boolean(row.module_gallery_enabled),
    folderText: String(row.folder_text ?? ''),
  }
}

export function rowToFileItem(row: Record<string, unknown>): FileItem {
  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    categorySlug: (row.category_slug as string) ?? '',
    categoryName: (row.category_name as string) ?? '',
    folderId: (row.folder_id as string) ?? null,
    title: row.title as string,
    originalName: row.original_name as string,
    mimeType: row.mime_type as string,
    sizeBytes: Number(row.size_bytes ?? 0),
    hasPreview: isThumbnailPreviewPath(
      row.preview_path as string | null,
      row.storage_path as string,
    ),
    sortOrder: Number(row.sort_order ?? 0),
    inGallery: Boolean(row.in_gallery),
    gallerySortOrder: Number(row.gallery_sort_order ?? 0),
    createdAt: rowTimestamp(row.created_at),
    updatedAt: rowTimestamp(row.updated_at) || rowTimestamp(row.created_at),
  }
}

function parseStorageType(value: unknown): FileStorageType {
  return value === 'gcs' ? 'gcs' : 'local'
}

export const FILE_ITEM_SELECT = `
  f.*,
  c.slug AS category_slug,
  c.name AS category_name,
  c.storage_type AS category_storage_type
`

export const FILE_ITEM_FROM = `
  FROM file_items f
  JOIN file_categories c ON c.id = f.category_id
`
