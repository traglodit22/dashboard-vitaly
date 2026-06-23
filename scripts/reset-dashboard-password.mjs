#!/usr/bin/env node
/**
 * Сброс пароля пользователя дашборда (на сервере: node scripts/reset-dashboard-password.mjs email newPassword)
 */
import { createHash } from 'crypto'
import pg from 'pg'

const email = process.argv[2]?.trim()
const password = process.argv[3]

if (!email || !password) {
  console.error('Usage: node scripts/reset-dashboard-password.mjs <email> <new-password>')
  process.exit(1)
}

if (password.length < 8) {
  console.error('Пароль должен быть не короче 8 символов')
  process.exit(1)
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL не задан')
  process.exit(1)
}

const hash = createHash('sha256').update(password).digest('hex')
const client = new pg.Client({ connectionString: databaseUrl })

try {
  await client.connect()
  const res = await client.query(
    `INSERT INTO dashboard_users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING email`,
    [email, hash],
  )
  if (!res.rowCount) {
    console.error('Не удалось обновить пользователя')
    process.exit(1)
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (adminEmail && email.toLowerCase() === adminEmail) {
    await client.query(
      'UPDATE system_settings SET admin_password_hash = $1 WHERE id = 1',
      [hash],
    )
  }

  console.log(`Пароль обновлён для ${res.rows[0].email}`)
} finally {
  await client.end()
}
