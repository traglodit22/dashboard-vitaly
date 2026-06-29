import { query } from '@/lib/db/index'
import { gcsBucketName, getSigningStorage, isGcsConfigured } from '@/lib/files/gcsStorage'

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
  source: 'gcs' | 'database'
}

const CACHE_TTL_MS = 10 * 60 * 1000
const LIST_RETRIES = 4
const LIST_DELAYS_MS = [0, 1500, 4000, 8000]

const BREAKDOWN_LABELS: Record<string, string> = {
  'dashboard/cloud': 'Облако',
  'dashboard/gallery': 'Галерея',
  'dashboard/funko': 'Funko POP',
  'backups/vps': 'Бэкапы VPS',
}

let cache: { stats: Omit<GcsBucketStats, 'cached'>; expiresAt: number } | null = null

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function isTransientListError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('premature close') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('503') ||
    msg.includes('502')
  )
}

function breakdownKey(objectName: string): string {
  const parts = objectName.split('/')
  if (parts[0] === 'dashboard' && parts.length >= 2) {
    return `dashboard/${parts[1]}`
  }
  if (parts[0] === 'backups' && parts.length >= 2) {
    return `backups/${parts[1]}`
  }
  return parts[0] || '(корень)'
}

function labelForKey(key: string): string {
  return BREAKDOWN_LABELS[key] ?? key
}

async function listBucketFromGcs(): Promise<Omit<GcsBucketStats, 'cached' | 'source'>> {
  const storage = getSigningStorage()
  const bucket = storage.bucket(gcsBucketName())

  const breakdownMap = new Map<string, { objectCount: number; sizeBytes: number }>()
  let totalBytes = 0
  let objectCount = 0

  await new Promise<void>((resolve, reject) => {
    bucket
      .getFilesStream()
      .on('data', (file) => {
        const size = Number(file.metadata.size ?? 0)
        totalBytes += size
        objectCount += 1
        const key = breakdownKey(file.name)
        const cur = breakdownMap.get(key) ?? { objectCount: 0, sizeBytes: 0 }
        cur.objectCount += 1
        cur.sizeBytes += size
        breakdownMap.set(key, cur)
      })
      .on('error', reject)
      .on('end', () => resolve())
  })

  const breakdown = [...breakdownMap.entries()]
    .map(([prefix, v]) => ({
      prefix,
      label: labelForKey(prefix),
      objectCount: v.objectCount,
      sizeBytes: v.sizeBytes,
    }))
    .sort((a, b) => b.sizeBytes - a.sizeBytes)

  return {
    bucket: gcsBucketName(),
    objectCount,
    totalBytes,
    breakdown,
    fetchedAt: new Date().toISOString(),
  }
}

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

async function fetchBucketStats(): Promise<Omit<GcsBucketStats, 'cached'>> {
  let lastError: unknown

  for (let i = 0; i < LIST_RETRIES; i++) {
    if (LIST_DELAYS_MS[i]) await sleep(LIST_DELAYS_MS[i])
    try {
      const stats = await listBucketFromGcs()
      return { ...stats, source: 'gcs' }
    } catch (err) {
      lastError = err
      console.error(`[gcs-stats] list attempt ${i + 1}/${LIST_RETRIES} failed:`, err)
      if (!isTransientListError(err)) break
    }
  }

  console.warn('[gcs-stats] falling back to database estimate:', lastError)
  const stats = await listBucketFromDatabase()
  return { ...stats, source: 'database' }
}

export async function getGcsBucketStats(forceRefresh = false): Promise<GcsBucketStats | null> {
  if (!isGcsConfigured()) return null

  if (!forceRefresh && cache && Date.now() < cache.expiresAt) {
    return { ...cache.stats, cached: true }
  }

  const stats = await fetchBucketStats()
  cache = { stats, expiresAt: Date.now() + CACHE_TTL_MS }
  return { ...stats, cached: false }
}
