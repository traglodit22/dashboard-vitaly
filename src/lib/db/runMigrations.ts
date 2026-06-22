import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { pool } from '@/lib/db/index'

function migrationsDir(): string {
  const candidates = [
    join(process.cwd(), 'db/migrations'),
    join(process.cwd(), 'src/lib/db/migrations'),
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }
  throw new Error('Migrations directory not found')
}

export async function runMigrations(): Promise<string[]> {
  const dir = migrationsDir()
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const applied: string[] = []
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8')
    await pool.query(sql)
    applied.push(file)
  }
  return applied
}
