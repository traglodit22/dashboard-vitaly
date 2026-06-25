import { pool, query } from '@/lib/db/index'
import { verifyPassword } from '@/lib/auth/password'

const USERS_DDL = `
CREATE TABLE IF NOT EXISTS dashboard_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

/** Создаёт таблицу и недостающих пользователей. Не перезаписывает пароли. */
export async function ensureDashboardUsers(): Promise<void> {
  await pool.query(USERS_DDL)

  const seedEmail = process.env.DASHBOARD_SEED_EMAIL?.trim()
  const seedHash = process.env.DASHBOARD_SEED_PASSWORD_HASH?.trim()
  if (seedEmail && seedHash) {
    await pool.query(
      `INSERT INTO dashboard_users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING`,
      [seedEmail, seedHash],
    )
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim()
  if (!adminEmail) return

  const existing = await query<{ password_hash: string }>(
    `SELECT password_hash FROM dashboard_users
     WHERE lower(trim(email)) = lower(trim($1))
     LIMIT 1`,
    [adminEmail],
  )

  if (existing[0]) {
    await pool.query(
      `UPDATE system_settings
       SET admin_password_hash = $1
       WHERE id = 1 AND (admin_password_hash IS NULL OR admin_password_hash = '')`,
      [existing[0].password_hash],
    )
    return
  }

  const rows = await query<{ admin_password_hash: string | null }>(
    'SELECT admin_password_hash FROM system_settings WHERE id = 1',
  )
  const dbHash = rows[0]?.admin_password_hash ?? null
  const activeHash = dbHash ?? process.env.ADMIN_PASSWORD_HASH ?? ''
  if (!activeHash) return

  await pool.query(
    `INSERT INTO dashboard_users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING`,
    [adminEmail, activeHash],
  )

  await pool.query(
    `UPDATE system_settings
     SET admin_password_hash = $1
     WHERE id = 1 AND (admin_password_hash IS NULL OR admin_password_hash = '')`,
    [activeHash],
  )
}

export async function findUserByCredentials(
  email: string,
  password: string,
): Promise<{ email: string } | null> {
  await ensureDashboardUsers()

  const rows = await query<{ email: string; password_hash: string }>(
    `SELECT email, password_hash FROM dashboard_users
     WHERE lower(trim(email)) = lower(trim($1))
     LIMIT 1`,
    [email],
  )

  const row = rows[0]
  if (row && (await verifyPassword(password, row.password_hash))) {
    return { email: row.email }
  }

  return null
}

export async function listDashboardUsers(): Promise<{ email: string; createdAt: string }[]> {
  await ensureDashboardUsers()
  const rows = await query<{ email: string; created_at: string }>(
    `SELECT email, created_at::text AS created_at
     FROM dashboard_users
     ORDER BY created_at ASC`,
  )
  return rows.map((r) => ({ email: r.email, createdAt: r.created_at }))
}
