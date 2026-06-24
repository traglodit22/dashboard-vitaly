export const GALLERY_CHANGED_EVENT = 'gallery:changed'

export function notifyGalleryChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(GALLERY_CHANGED_EVENT))
  }
}
