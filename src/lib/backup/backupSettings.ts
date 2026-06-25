import { query } from '@/lib/db/index'
import type { VpsBackupSettings } from '@/lib/backup/types'
import { ensureVpsBackupSchema } from '@/lib/backup/vpsBackup'

function clampHour(value: number): number {
  if (!Number.isFinite(value)) return 3
  return Math.min(23, Math.max(0, Math.round(value)))
}

function clampWeeklyDay(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(6, Math.max(0, Math.round(value)))
}

function clampRetention(value: number): number {
  if (!Number.isFinite(value)) return 30
  return Math.min(100, Math.max(1, Math.round(value)))
}

function rowToSettings(row: Record<string, unknown>): VpsBackupSettings {
  return {
    dailyEnabled: row.backup_daily_enabled !== false,
    weeklyEnabled: row.backup_weekly_enabled !== false,
    retentionCount: clampRetention(Number(row.backup_retention_count ?? 30)),
    dailyHour: clampHour(Number(row.backup_daily_hour ?? 3)),
    weeklyDay: clampWeeklyDay(Number(row.backup_weekly_day ?? 0)),
    lastDailyAt: (row.backup_last_daily_at as string) ?? null,
    lastWeeklyAt: (row.backup_last_weekly_at as string) ?? null,
  }
}

export async function getVpsBackupSettings(): Promise<VpsBackupSettings> {
  await ensureVpsBackupSchema()
  const rows = await query<Record<string, unknown>>(
    `SELECT backup_daily_enabled, backup_weekly_enabled, backup_retention_count,
            backup_daily_hour, backup_weekly_day, backup_last_daily_at, backup_last_weekly_at
     FROM system_settings WHERE id = 1`,
  )
  return rowToSettings(rows[0] ?? {})
}

export async function saveVpsBackupSettings(
  input: Partial<VpsBackupSettings>,
): Promise<VpsBackupSettings> {
  await ensureVpsBackupSchema()
  const current = await getVpsBackupSettings()
  const next: VpsBackupSettings = {
    dailyEnabled: input.dailyEnabled ?? current.dailyEnabled,
    weeklyEnabled: input.weeklyEnabled ?? current.weeklyEnabled,
    retentionCount: clampRetention(input.retentionCount ?? current.retentionCount),
    dailyHour: clampHour(input.dailyHour ?? current.dailyHour),
    weeklyDay: clampWeeklyDay(input.weeklyDay ?? current.weeklyDay),
    lastDailyAt: current.lastDailyAt,
    lastWeeklyAt: current.lastWeeklyAt,
  }

  await query(
    `UPDATE system_settings SET
      backup_daily_enabled = $1,
      backup_weekly_enabled = $2,
      backup_retention_count = $3,
      backup_daily_hour = $4,
      backup_weekly_day = $5
     WHERE id = 1`,
    [
      next.dailyEnabled,
      next.weeklyEnabled,
      next.retentionCount,
      next.dailyHour,
      next.weeklyDay,
    ],
  )

  return next
}

export async function markBackupRun(kind: 'daily' | 'weekly', at = new Date()): Promise<void> {
  const iso = at.toISOString()
  if (kind === 'daily') {
    await query('UPDATE system_settings SET backup_last_daily_at = $1 WHERE id = 1', [iso])
    return
  }
  await query(
    `UPDATE system_settings SET backup_last_daily_at = $1, backup_last_weekly_at = $1 WHERE id = 1`,
    [iso],
  )
}
