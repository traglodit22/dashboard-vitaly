import { spawn } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { pipeline } from 'stream/promises'
import { createGzip } from 'zlib'
import { createReadStream, createWriteStream } from 'fs'
import { query } from '@/lib/db/index'
import { getGcsReadSignedUrl, isGcsConfigured, uploadToGcs } from '@/lib/files/gcsStorage'
import type { VpsBackupRun } from '@/lib/backup/types'

const BACKUP_DDL = `
CREATE TABLE IF NOT EXISTS vps_backup_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stamp           TEXT NOT NULL,
  database_key    TEXT,
  files_key       TEXT,
  database_bytes  BIGINT,
  files_bytes     BIGINT,
  status          TEXT NOT NULL DEFAULT 'ok',
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vps_backup_runs_created_idx
  ON vps_backup_runs (created_at DESC);
`

let ensured = false

export async function ensureVpsBackupSchema(): Promise<void> {
  if (ensured) return
  const { pool } = await import('@/lib/db/index')
  await pool.query(BACKUP_DDL)
  ensured = true
}

function uploadsRoot(): string {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
}

function backupStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function backupObjectKey(stamp: string, kind: 'database' | 'files'): string {
  const name = kind === 'database' ? 'database.sql.gz' : 'uploads.tar.gz'
  return `backups/vps/${stamp}/${name}`
}

async function runCommand(
  cmd: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...env } })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `${cmd} завершился с кодом ${code}`))
    })
  })
}

async function dumpDatabase(outPath: string): Promise<void> {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL не задан')

  const dump = spawn('pg_dump', [url, '--no-owner', '--no-acl'], { env: process.env })
  dump.stderr.on('data', (chunk: Buffer) => {
    console.error('[backup] pg_dump:', chunk.toString().trim())
  })

  const exitP = new Promise<void>((resolve, reject) => {
    dump.on('error', (err) => reject(new Error(`pg_dump недоступен: ${err.message}`)))
    dump.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`pg_dump завершился с кодом ${code}`))
    })
  })

  await Promise.all([
    pipeline(dump.stdout, createGzip(), createWriteStream(outPath)),
    exitP,
  ])
}

async function archiveUploads(outPath: string): Promise<void> {
  const root = uploadsRoot()
  try {
    await fs.access(root)
  } catch {
    throw new Error(`Папка uploads не найдена: ${root}`)
  }
  await runCommand('tar', ['-czf', outPath, '-C', root, '.'])
}

async function uploadFile(objectKey: string, filePath: string, mime: string): Promise<number> {
  const stat = await fs.stat(filePath)
  const buffer = await fs.readFile(filePath)
  await uploadToGcs(objectKey, buffer, mime)
  return stat.size
}

function rowToRun(row: Record<string, unknown>, urls?: { databaseUrl?: string; filesUrl?: string }): VpsBackupRun {
  return {
    id: row.id as string,
    stamp: row.stamp as string,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    databaseKey: (row.database_key as string) ?? null,
    filesKey: (row.files_key as string) ?? null,
    databaseBytes: row.database_bytes != null ? Number(row.database_bytes) : null,
    filesBytes: row.files_bytes != null ? Number(row.files_bytes) : null,
    databaseUrl: urls?.databaseUrl ?? null,
    filesUrl: urls?.filesUrl ?? null,
    status: row.status === 'error' ? 'error' : 'ok',
    errorMessage: (row.error_message as string) ?? null,
  }
}

export async function listVpsBackupRuns(limit = 15): Promise<VpsBackupRun[]> {
  await ensureVpsBackupSchema()
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM vps_backup_runs ORDER BY created_at DESC LIMIT $1`,
    [limit],
  )

  const out: VpsBackupRun[] = []
  for (const row of rows) {
    const urls: { databaseUrl?: string; filesUrl?: string } = {}
    if (isGcsConfigured() && row.database_key) {
      try {
        urls.databaseUrl = await getGcsReadSignedUrl(row.database_key as string, {
          attachment: true,
          fileName: `database-${row.stamp}.sql.gz`,
        })
      } catch {
        /* signed url failed */
      }
    }
    if (isGcsConfigured() && row.files_key) {
      try {
        urls.filesUrl = await getGcsReadSignedUrl(row.files_key as string, {
          attachment: true,
          fileName: `uploads-${row.stamp}.tar.gz`,
        })
      } catch {
        /* signed url failed */
      }
    }
    out.push(rowToRun(row, urls))
  }
  return out
}

export async function runVpsBackup(options: {
  database?: boolean
  files?: boolean
}): Promise<VpsBackupRun> {
  if (!options.database && !options.files) {
    throw new Error('Выберите хотя бы один тип бэкапа')
  }
  if (!isGcsConfigured()) {
    throw new Error('Google Cloud Storage не настроен (GCS_BUCKET и ключи)')
  }

  await ensureVpsBackupSchema()

  const stamp = backupStamp()
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vps-backup-'))
  let databaseKey: string | null = null
  let filesKey: string | null = null
  let databaseBytes: number | null = null
  let filesBytes: number | null = null

  try {
    if (options.database) {
      const dbPath = path.join(tmpDir, 'database.sql.gz')
      await dumpDatabase(dbPath)
      databaseKey = backupObjectKey(stamp, 'database')
      databaseBytes = await uploadFile(databaseKey, dbPath, 'application/gzip')
    }

    if (options.files) {
      const filesPath = path.join(tmpDir, 'uploads.tar.gz')
      await archiveUploads(filesPath)
      filesKey = backupObjectKey(stamp, 'files')
      filesBytes = await uploadFile(filesKey, filesPath, 'application/gzip')
    }

    const inserted = await query<Record<string, unknown>>(
      `INSERT INTO vps_backup_runs
        (stamp, database_key, files_key, database_bytes, files_bytes, status)
       VALUES ($1, $2, $3, $4, $5, 'ok')
       RETURNING *`,
      [stamp, databaseKey, filesKey, databaseBytes, filesBytes],
    )

    const urls: { databaseUrl?: string; filesUrl?: string } = {}
    if (databaseKey) {
      urls.databaseUrl = await getGcsReadSignedUrl(databaseKey, {
        attachment: true,
        fileName: `database-${stamp}.sql.gz`,
      })
    }
    if (filesKey) {
      urls.filesUrl = await getGcsReadSignedUrl(filesKey, {
        attachment: true,
        fileName: `uploads-${stamp}.tar.gz`,
      })
    }

    return rowToRun(inserted[0], urls)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await query(
      `INSERT INTO vps_backup_runs
        (stamp, database_key, files_key, database_bytes, files_bytes, status, error_message)
       VALUES ($1, $2, $3, $4, $5, 'error', $6)`,
      [stamp, databaseKey, filesKey, databaseBytes, filesBytes, message.slice(0, 2000)],
    )
    throw err
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
