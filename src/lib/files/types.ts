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
  sortOrder: number
  createdAt: string
  moduleTextEnabled: boolean
  moduleGalleryEnabled: boolean
  folderText: string
  isFavorite: boolean
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
  sortOrder: number
  inGallery: boolean
  gallerySortOrder: number
  createdAt: string
  updatedAt: string
  contentHash: string | null
  capturedAt: string | null
}

export const IMPORTANT_DOCS_SLUG = 'important-documents'
export const CLOUD_SLUG = 'cloud'
export const GALLERY_SLUG = 'gallery'

export const LOCAL_ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
  'image/vnd.dwg',
  'application/acad',
  'application/x-acad',
  'application/dwg',
  'application/vnd.dwg',
])

export const MAX_FILE_MB = 50
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024
export const MAX_FILE_SIZE_ERROR = `Максимальный размер файла — ${MAX_FILE_MB} МБ`
/** Таймаут загрузки через прокси (браузер → VPS → GCS). */
export const UPLOAD_TIMEOUT_MS = 300_000

export const FOLDER_KEEP_NAME = '.keep'
