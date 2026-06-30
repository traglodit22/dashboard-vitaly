import { query } from '@/lib/db/index'
import { gcsBucketName, isGcsConfigured } from '@/lib/files/gcsStorage'

export type GcsBucketStatsBreakdown = {
  prefix: string
  label: string
  objectCount: number
  sizeBytes: number
}

export type GcsBucketStats = {
  bucket: string
  objectCount: number
  totalBytes: number
  breakdown: GcsBucketStatsBreakdown[]
  fetchedAt: string
  cached: boolean
  source: 'database'
}

const CACHE_TTL_MS = 10 * 60 * 1000

const BREAKDOWN_LABELS: Record<string, string> = {
  'dashboard/cloud': 'Облако',
  'dashboard/gallery': 'Галерея',
  'dashboard/funko': 'Funko POP',
  'backups/vps': 'Бэкапы VPS',
}

let cache: { stats: Omit<GcsBucketStats, 'cached'>; expiresAt: number } | null = null

async function listBucketFromDatabase(): Promise<Omit<GcsBucketStats, 'cached' | 'source'>> {
  const fileRows = await query<{
    prefix: string
    label: string
    object_count: number
    size_bytes: string
    preview_count: number
  }>(`
    SELECT
      'dashboard/' || fc.slug AS prefix,
      fc.name AS label,
      COUNT(fi.id)::int AS object_count,
      COALESCE(SUM(fi.size_bytes), 0)::bigint AS size_bytes,
      COUNT(fi.id) FILTER (WHERE fi.preview_path IS NOT NULL AND fi.preview_path != '')::int AS preview_count
    FROM file_items fi
    JOIN file_categories fc ON fc.id = fi.category_id
    WHERE fc.storage_type = 'gcs'
    GROUP BY fc.slug, fc.name
  `)

  const backupRows = await query<{
    object_count: number
    size_bytes: string
  }>(`
    SELECT
      COUNT(*)::int AS object_count,
      COALESCE(SUM(COALESCE(database_bytes, 0) + COALESCE(files_bytes, 0)), 0)::bigint AS size_bytes
    FROM vps_backup_runs
    WHERE status = 'ok'
      AND (database_key IS NOT NULL OR files_key IS NOT NULL)
  `)

  const funkoRows = await query<{ object_count: number }>(`
    SELECT COUNT(*)::int AS object_count
    FROM funko_items
    WHERE image_gcs_key IS NOT NULL AND image_gcs_key != ''
  `)

  const breakdown: GcsBucketStatsBreakdown[] = fileRows.map((row) => ({
    prefix: row.prefix,
    label: row.label,
    objectCount: row.object_count + row.preview_count,
    sizeBytes: Number(row.size_bytes),
  }))

  const backup = backupRows[0]
  if (backup && backup.object_count > 0) {
    breakdown.push({
      prefix: 'backups/vps',
      label: BREAKDOWN_LABELS['backups/vps'],
      objectCount: backup.object_count,
      sizeBytes: Number(backup.size_bytes),
    })
  }

  const funkoCount = funkoRows[0]?.object_count ?? 0
  if (funkoCount > 0) {
    const existing = breakdown.find((b) => b.prefix === 'dashboard/funko')
    if (existing) {
      existing.objectCount += funkoCount
    } else {
      breakdown.push({
        prefix: 'dashboard/funko',
        label: BREAKDOWN_LABELS['dashboard/funko'],
        objectCount: funkoCount,
        sizeBytes: 0,
      })
    }
  }

  breakdown.sort((a, b) => b.sizeBytes - a.sizeBytes)

  const totalBytes = breakdown.reduce((sum, row) => sum + row.sizeBytes, 0)
  const objectCount = breakdown.reduce((sum, row) => sum + row.objectCount, 0)

  return {
    bucket: gcsBucketName(),
    objectCount,
    totalBytes,
    breakdown,
    fetchedAt: new Date().toISOString(),
  }
}

export async function getGcsBucketStats(forceRefresh = false): Promise<GcsBucketStats | null> {
  if (!isGcsConfigured()) return null

  if (!forceRefresh && cache && Date.now() < cache.expiresAt) {
    return { ...cache.stats, cached: true }
  }

  const stats = await listBucketFromDatabase()
  const fullStats = { ...stats, source: 'database' as const }
  cache = { stats: fullStats, expiresAt: Date.now() + CACHE_TTL_MS }
  return { ...fullStats, cached: false }
}
