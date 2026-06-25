export type VpsBackupKind = 'manual' | 'daily' | 'weekly'
export type VpsBackupSource = 'manual' | 'cron'

export interface VpsBackupRun {
  id: string
  stamp: string
  kind: VpsBackupKind
  source: VpsBackupSource
  createdAt: string
  databaseKey: string | null
  filesKey: string | null
  databaseBytes: number | null
  filesBytes: number | null
  databaseUrl: string | null
  filesUrl: string | null
  status: 'ok' | 'error'
  errorMessage: string | null
}

export interface VpsBackupSettings {
  dailyEnabled: boolean
  weeklyEnabled: boolean
  retentionCount: number
  dailyHour: number
  weeklyDay: number
  lastDailyAt: string | null
  lastWeeklyAt: string | null
}

export interface VpsBackupResult {
  run: VpsBackupRun
}
