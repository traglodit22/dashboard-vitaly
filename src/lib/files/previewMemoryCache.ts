const MAX_ENTRIES = 300

const cache = new Map<string, { etag: string; buffer: Buffer }>()

export function getCachedPreview(fileId: string, etag: string): Buffer | null {
  const hit = cache.get(fileId)
  if (hit && hit.etag === etag) return hit.buffer
  return null
}

export function setCachedPreview(fileId: string, etag: string, buffer: Buffer): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(fileId, { etag, buffer })
}

export function dropCachedPreview(fileId: string): void {
  cache.delete(fileId)
}
