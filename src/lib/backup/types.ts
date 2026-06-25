export interface VpsBackupRun {
  id: string
  stamp: string
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

export interface VpsBackupResult {
  run: VpsBackupRun
}
