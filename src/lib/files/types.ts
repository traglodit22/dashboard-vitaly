export type FileStorageType = 'local' | 'gcs'

export interface FileCategory {
  id: string
  slug: string
  name: string
  storageType: FileStorageType
  sortOrder: number
}

export interface FileFolder {
  id: string
  categoryId: string
  parentId: string | null
  name: string
  createdAt: string
}

export interface FileItem {
  id: string
  categoryId: string
  categorySlug: string
  categoryName: string
  folderId: string | null
  title: string
  originalName: string
  mimeType: string
  sizeBytes: number
  hasPreview: boolean
  createdAt: string
}

export const IMPORTANT_DOCS_SLUG = 'important-documents'

export const LOCAL_ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export const MAX_FILE_BYTES = 20 * 1024 * 1024

export const FOLDER_KEEP_NAME = '.keep'
