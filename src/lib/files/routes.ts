import { IMPORTANT_DOCS_SLUG } from '@/lib/files/types'

export const CLOUD_SLUG = 'cloud'

export const FILE_CATEGORY_SLUGS = [IMPORTANT_DOCS_SLUG, CLOUD_SLUG] as const
export type FileCategorySlug = (typeof FILE_CATEGORY_SLUGS)[number]

export function isFileCategorySlug(slug: string): slug is FileCategorySlug {
  return (FILE_CATEGORY_SLUGS as readonly string[]).includes(slug)
}

export function filesCategoryPath(slug: string, folderId?: string | null): string {
  const base = `/files/${slug}`
  if (folderId) return `${base}?folder=${encodeURIComponent(folderId)}`
  return base
}

export function filesCategoryFromPathname(pathname: string): FileCategorySlug | null {
  const match = pathname.match(/^\/files\/([^/?]+)/)
  const slug = match?.[1]
  return slug && isFileCategorySlug(slug) ? slug : null
}

export const FILES_CHANGED_EVENT = 'files:changed'

export function notifyFilesChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FILES_CHANGED_EVENT))
  }
}
