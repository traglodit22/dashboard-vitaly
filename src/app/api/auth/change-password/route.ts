import { getSession, getSessionEmail } from '@/lib/auth/session'
import { hashPassword } from '@/lib/auth/password'
import { query } from '@/lib/db/index'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  if (!(await getSession(req))) {
    return Response.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const email = await getSessionEmail(req)
  if (!email) {
    return Response.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { currentPassword, newPassword } = (await req.json()) as {
    currentPassword?: string
    newPassword?: string
  }

  if (!currentPassword || !newPassword) {
    return Response.json({ error: 'Укажите текущий и новый пароль' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return Response.json({ error: 'Новый пароль — минимум 8 символов' }, { status: 400 })
  }

  const rows = await query<{ password_hash: string }>(
    `SELECT password_hash FROM dashboard_users
     WHERE lower(trim(email)) = lower(trim($1)) LIMIT 1`,
    [email],
  )

  let activeHash: string | null = rows[0]?.password_hash ?? null

  if (!activeHash && email === (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()) {
    const settings = await query<{ admin_password_hash: string | null }>(
      'SELECT admin_password_hash FROM system_settings WHERE id = 1',
    )
    activeHash = settings[0]?.admin_password_hash ?? process.env.ADMIN_PASSWORD_HASH ?? null
  }

  if (!activeHash) {
    return Response.json({ error: 'Пользователь не найден' }, { status: 404 })
  }

  const currentHash = hashPassword(currentPassword)
  if (currentHash !== activeHash) {
    return Response.json({ error: 'Неверный текущий пароль' }, { status: 401 })
  }

  const newHash = hashPassword(newPassword)
  await query(
    `INSERT INTO dashboard_users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [email, newHash],
  )

  if (email === (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()) {
    await query('UPDATE system_settings SET admin_password_hash = $1 WHERE id = 1', [newHash])
  }

  return Response.json({ ok: true })
}
