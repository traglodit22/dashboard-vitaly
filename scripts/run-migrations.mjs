#!/usr/bin/env node
/**
 * Прогон SQL-миграций из src/lib/db/migrations/*.sql
 * DATABASE_URL — из окружения или из .env в корне проекта.
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Client } = pg
const __dirname = dirname(fileURLToPath(import.meta.url))

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = join(__dirname, '..', '.env')
  if (!existsSync(envPath)) return null
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (key !== 'DATABASE_URL') continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    return value
  }
  return null
}

async function main() {
  const url = loadDatabaseUrl()
  if (!url) {
    console.log('    skip (DATABASE_URL not set)')
    return
  }

  const dir = join(__dirname, '..', 'src', 'lib', 'db', 'migrations')
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
  })
  await client.connect()

  try {
    for (const file of files) {
      const sql = readFileSync(join(dir, file), 'utf8')
      console.log(`    ${file}`)
      try {
        await client.query(sql)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('must be owner of table')) {
          console.log(`    skip ${file} (needs postgres owner — use deploy/apply-migrations-postgres.sh)`)
          continue
        }
        throw err
      }
    }
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
