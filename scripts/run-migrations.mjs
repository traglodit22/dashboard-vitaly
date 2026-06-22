#!/usr/bin/env node
/**
 * Прогон SQL-миграций из src/lib/db/migrations/*.sql
 * Использует DATABASE_URL из окружения (deploy.sh подгружает .env).
 */
const { readFileSync, readdirSync } = require('fs')
const { join } = require('path')
const { Client } = require('pg')

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.log('    skip (DATABASE_URL not set)')
    return
  }

  const dir = join(__dirname, '..', 'src', 'lib', 'db', 'migrations')
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const client = new Client({ connectionString: url })
  await client.connect()

  try {
    for (const file of files) {
      const sql = readFileSync(join(dir, file), 'utf8')
      console.log(`    ${file}`)
      await client.query(sql)
    }
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
