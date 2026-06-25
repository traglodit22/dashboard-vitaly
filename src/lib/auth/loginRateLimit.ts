const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 20

const buckets = new Map<string, { count: number; resetAt: number }>()

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

export function isLoginRateLimited(req: Request): boolean {
  const key = clientIp(req)
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  bucket.count += 1
  return bucket.count > MAX_ATTEMPTS
}

export function clearLoginRateLimit(req: Request): void {
  buckets.delete(clientIp(req))
}
