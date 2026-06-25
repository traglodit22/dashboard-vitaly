import { createSession } from '@/lib/auth/session'
import { findUserByCredentials } from '@/lib/auth/ensureUsers'
import { clearLoginRateLimit, isLoginRateLimited } from '@/lib/auth/loginRateLimit'
import { verifyPassword } from '@/lib/auth/password'
import { query } from '@/lib/db/index'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  if (isLoginRateLimited(req)) {
    return Response.json(
      { error: 'Слишком много попыток входа. Подождите 15 минут.' },
      { status: 429 },
    )
  }

  const { email, password } = (await req.json()) as { email?: string; password?: string }

  if (!email || !password) {
    return Response.json({ error: 'Email и пароль обязательны' }, { status: 400 })
  }

  const user = await findUserByCredentials(email, password)
  if (user) {
    clearLoginRateLimit(req)
    await createSession(user.email, req)
    return Response.json({ ok: true })
  }

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    return Response.json({ error: 'Неверный email или пароль' }, { status: 401 })
  }

  const rows = await query<{ admin_password_hash: string | null }>(
    'SELECT admin_password_hash FROM system_settings WHERE id = 1',
  )
  const dbHash = rows[0]?.admin_password_hash ?? null
  const activeHash = dbHash ?? (process.env.ADMIN_PASSWORD_HASH ?? '')

  const emailMatch = email.trim().toLowerCase() === adminEmail.trim().toLowerCase()
  const passwordMatch = Boolean(activeHash) && (await verifyPassword(password, activeHash))

  if (!emailMatch || !passwordMatch) {
    return Response.json({ error: 'Неверный email или пароль' }, { status: 401 })
  }

  clearLoginRateLimit(req)
  await createSession(adminEmail, req)
  return Response.json({ ok: true })
}
