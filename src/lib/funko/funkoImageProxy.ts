const ALLOWED_HOSTS = new Set([
  'storage.googleapis.com',
  'static.wikia.nocookie.net',
  'images.hobbydb.com',
])

export function isAllowedFunkoImageProxyUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    if (!ALLOWED_HOSTS.has(u.hostname)) return false
    if (u.hostname === 'storage.googleapis.com' && !u.pathname.startsWith('/images.pricecharting.com/')) {
      return false
    }
    return true
  } catch {
    return false
  }
}

export function funkoImageProxyPath(sourceUrl: string): string {
  return `/api/funko/image-proxy?url=${encodeURIComponent(sourceUrl)}`
}
