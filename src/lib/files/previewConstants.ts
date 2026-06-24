/** Макс. ширина/высота превью в карточках (WebP). */
export const PREVIEW_MAX_PX = 320

export const PREVIEW_CACHE_CONTROL = 'private, max-age=31536000, immutable'

export function isThumbnailPreviewPath(
  previewPath: string | null | undefined,
  storagePath: string,
): boolean {
  if (!previewPath) return false
  return previewPath.endsWith('-preview.webp') && previewPath !== storagePath
}
