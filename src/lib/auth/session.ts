import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = '__session'
const EXPIRY_SECONDS = 30 * 24 * 60 * 60 // 30 days

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  return new TextEncoder().encode(secret)
}

function isSecureRequest(req?: Request): boolean {
  if (process.env.HTTPS_ONLY === 'true') return true
  const proto = req?.headers.get('x-forwarded-proto')
  if (proto) return proto.split(',')[0]?.trim() === 'https'
  return false
}

function sessionCookieOptions(req?: Request, maxAge = EXPIRY_SECONDS) {
  return {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

export async function createSession(email: string, req?: Request): Promise<void> {
  const token = await new SignJWT({ admin: true, email: email.trim().toLowerCase() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_SECONDS}s`)
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, sessionCookieOptions(req))
}

export async function getSessionEmail(req: Request): Promise<string | null> {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))
  const token = match?.[1]
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const email = payload.email
    return typeof email === 'string' ? email : null
  } catch {
    return null
  }
}

export async function getSession(req: Request): Promise<boolean> {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))
  const token = match?.[1]
  if (!token) return false
  try {
    await jwtVerify(token, getSecret())
    return true
  } catch {
    return false
  }
}

export async function clearSession(req?: Request): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, '', sessionCookieOptions(req, 0))
}
