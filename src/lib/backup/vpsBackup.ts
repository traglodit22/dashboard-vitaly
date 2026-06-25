import { spawn } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { pipeline } from 'stream/promises'
import { createGzip } from 'zlib'
import { createWriteStream } from 'fs'
import { query } from '@/lib/db/index'
import {
  deleteFromGcs,
  getGcsReadSignedUrl,
  isGcsConfigured,
  uploadLocalFileToGcs,
} from '@/lib/files/gcsStorage'
import {
  getVpsBackupSettings,
  markBackupRun,
} from '@/lib/backup/backupSettings'
import { getMinskNow, minskDateKey } from '@/lib/backup/timezone'
import type {
  VpsBackupKind,
  VpsBackupRun,
  VpsBackupSource,
} from '@/lib/backup/types'

const BACKUP_DDL = `
CREATE TABLE IF NOT EXISTS vps_backup_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stamp           TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'manual',
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

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS backup_daily_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS backup_weekly_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS backup_retention_count INTEGER NOT NULL DEFAULT 30;
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS backup_daily_hour INTEGER NOT NULL DEFAULT 3;
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS backup_weekly_day INTEGER NOT NULL DEFAULT 0;
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS backup_last_daily_at TIMESTAMPTZ;
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS backup_last_weekly_at TIMESTAMPTZ;
ALTER TABLE vps_backup_runs
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'manual';
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

function normalizeKind(value: unknown): VpsBackupKind {
  if (value === 'daily' || value === 'weekly') return value
  return 'manual'
}

function rowToRun(row: Record<string, unknown>, urls?: { databaseUrl?: string; filesUrl?: string }): VpsBackupRun {
  return {
    id: row.id as string,
    stamp: row.stamp as string,
    kind: normalizeKind(row.kind),
    source: 'manual',
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

export async function listVpsBackupRuns(limit = 30): Promise<VpsBackupRun[]> {
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

export async function pruneOldBackups(retentionCount: number): Promise<number> {
  await ensureVpsBackupSchema()
  const rows = await query<Record<string, unknown>>(
    `SELECT id, database_key, files_key FROM vps_backup_runs ORDER BY created_at DESC`,
  )
  const toDelete = rows.slice(retentionCount)
  for (const row of toDelete) {
    if (row.database_key) {
      await deleteFromGcs(row.database_key as string).catch((err) => {
        console.error('[backup] delete db object:', err)
      })
    }
    if (row.files_key) {
      await deleteFromGcs(row.files_key as string).catch((err) => {
        console.error('[backup] delete files object:', err)
      })
    }
    await query('DELETE FROM vps_backup_runs WHERE id = $1', [row.id])
  }
  return toDelete.length
}

export async function runVpsBackup(options: {
  database?: boolean
  files?: boolean
  kind?: VpsBackupKind
  source?: VpsBackupSource
  prune?: boolean
}): Promise<VpsBackupRun> {
  if (!options.database && !options.files) {
    throw new Error('Выберите хотя бы один тип бэкапа')
  }
  if (!isGcsConfigured()) {
    throw new Error('Google Cloud Storage не настроен (GCS_BUCKET и ключи)')
  }

  await ensureVpsBackupSchema()

  const kind = options.kind ?? 'manual'
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
      databaseBytes = await uploadLocalFileToGcs(databaseKey, dbPath, 'application/gzip')
    }

    if (options.files) {
      const filesPath = path.join(tmpDir, 'uploads.tar.gz')
      await archiveUploads(filesPath)
      filesKey = backupObjectKey(stamp, 'files')
      filesBytes = await uploadLocalFileToGcs(filesKey, filesPath, 'application/gzip')
    }

    const inserted = await query<Record<string, unknown>>(
      `INSERT INTO vps_backup_runs
        (stamp, kind, database_key, files_key, database_bytes, files_bytes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ok')
       RETURNING *`,
      [stamp, kind, databaseKey, filesKey, databaseBytes, filesBytes],
    )

    if (options.prune !== false) {
      const settings = await getVpsBackupSettings()
      await pruneOldBackups(settings.retentionCount)
    }

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

    const run = rowToRun(inserted[0], urls)
    run.source = options.source ?? 'manual'
    return run
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await query(
      `INSERT INTO vps_backup_runs
        (stamp, kind, database_key, files_key, database_bytes, files_bytes, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, 'error', $7)`,
      [stamp, kind, databaseKey, filesKey, databaseBytes, filesBytes, message.slice(0, 2000)],
    )
    throw err
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

export async function runScheduledVpsBackup(): Promise<{
  skipped: string
  run?: VpsBackupRun
  pruned?: number
}> {
  const settings = await getVpsBackupSettings()
  if (!settings.dailyEnabled && !settings.weeklyEnabled) {
    return { skipped: 'disabled' }
  }

  const now = getMinskNow()
  if (now.hour !== settings.dailyHour) {
    return { skipped: 'wrong_hour' }
  }

  const weeklyDue =
    settings.weeklyEnabled &&
    now.day === settings.weeklyDay &&
    (!settings.lastWeeklyAt || minskDateKey(settings.lastWeeklyAt) !== now.dateKey)

  if (weeklyDue) {
    const run = await runVpsBackup({
      database: true,
      files: true,
      kind: 'weekly',
      source: 'cron',
    })
    await markBackupRun('weekly')
    return { skipped: 'none', run }
  }

  if (!settings.dailyEnabled) {
    return { skipped: 'daily_disabled' }
  }

  if (settings.lastDailyAt && minskDateKey(settings.lastDailyAt) === now.dateKey) {
    return { skipped: 'daily_already_ran' }
  }

  const run = await runVpsBackup({
    database: true,
    files: false,
    kind: 'daily',
    source: 'cron',
  })
  await markBackupRun('daily')
  return { skipped: 'none', run }
}
