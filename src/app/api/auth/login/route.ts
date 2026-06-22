import { createHash } from 'crypto'
import { createSession } from '@/lib/auth/session'
import { query } from '@/lib/db/index'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  const { email, password } = (await req.json()) as { email?: string; password?: string }

  if (!email || !password) {
    return Response.json({ error: 'Email и пароль обязательны' }, { status: 400 })
  }

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    return Response.json({ error: 'Сервер не настроен' }, { status: 500 })
  }

  // DB hash takes priority over env (allows password change without touching .env)
  const rows = await query<{ admin_password_hash: string | null }>(
    'SELECT admin_password_hash FROM system_settings WHERE id = 1',
  )
  const dbHash = rows[0]?.admin_password_hash ?? null
  const activeHash = dbHash ?? (process.env.ADMIN_PASSWORD_HASH ?? '')

  if (!activeHash) {
    return Response.json({ error: 'Сервер не настроен' }, { status: 500 })
  }

  const emailMatch = email.trim().toLowerCase() === adminEmail.trim().toLowerCase()
  const passwordHash = createHash('sha256').update(password).digest('hex')
  const passwordMatch = passwordHash === activeHash

  if (!emailMatch || !passwordMatch) {
    return Response.json({ error: 'Неверный email или пароль' }, { status: 401 })
  }

  await createSession()
  return Response.json({ ok: true })
}
