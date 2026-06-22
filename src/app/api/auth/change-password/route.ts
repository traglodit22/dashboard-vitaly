import { createHash } from 'crypto'
import { getSession } from '@/lib/auth/session'
import { query } from '@/lib/db/index'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  if (!(await getSession(req))) {
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

  // Current hash: check DB first, fall back to env
  const rows = await query<{ admin_password_hash: string | null }>(
    'SELECT admin_password_hash FROM system_settings WHERE id = 1',
  )
  const dbHash = rows[0]?.admin_password_hash ?? null
  const envHash = process.env.ADMIN_PASSWORD_HASH ?? ''
  const activeHash = dbHash ?? envHash

  const currentHash = createHash('sha256').update(currentPassword).digest('hex')
  if (currentHash !== activeHash) {
    return Response.json({ error: 'Неверный текущий пароль' }, { status: 401 })
  }

  const newHash = createHash('sha256').update(newPassword).digest('hex')
  await query('UPDATE system_settings SET admin_password_hash = $1 WHERE id = 1', [newHash])

  return Response.json({ ok: true })
}
