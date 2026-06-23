import { pool, query } from '@/lib/db/index'
import { hashPassword } from '@/lib/auth/password'

const USERS_DDL = `
CREATE TABLE IF NOT EXISTS dashboard_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

const NADINA_EMAIL = 'nadina2s@gmail.com'
// sha256 — пароль задан при деплое через seed
const NADINA_PASSWORD_HASH =
  'c58b1394bd53504f6416453800e4f7c61e63a4a7f2a53fa9c827e35724fcc8c8'

export async function ensureDashboardUsers(): Promise<void> {
  await pool.query(USERS_DDL)

  await pool.query(
    `INSERT INTO dashboard_users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [NADINA_EMAIL, NADINA_PASSWORD_HASH],
  )

  const adminEmail = process.env.ADMIN_EMAIL?.trim()
  if (!adminEmail) return

  const rows = await query<{ admin_password_hash: string | null }>(
    'SELECT admin_password_hash FROM system_settings WHERE id = 1',
  )
  const dbHash = rows[0]?.admin_password_hash ?? null
  const activeHash = dbHash ?? process.env.ADMIN_PASSWORD_HASH ?? ''
  if (!activeHash) return

  await pool.query(
    `INSERT INTO dashboard_users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [adminEmail, activeHash],
  )
}

export async function findUserByCredentials(
  email: string,
  password: string,
): Promise<{ email: string } | null> {
  await ensureDashboardUsers()

  const hash = hashPassword(password)
  const rows = await query<{ email: string }>(
    `SELECT email FROM dashboard_users
     WHERE lower(trim(email)) = lower(trim($1)) AND password_hash = $2
     LIMIT 1`,
    [email, hash],
  )
  return rows[0] ?? null
}
