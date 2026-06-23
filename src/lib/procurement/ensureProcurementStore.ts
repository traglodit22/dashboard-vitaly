import { pool, query } from '@/lib/db/index'
import { detectStoreFromUrl } from '@/lib/stores/detectStoreFromUrl'

export async function ensureProcurementStoreColumn(): Promise<void> {
  await pool.query('ALTER TABLE procurement_items ADD COLUMN IF NOT EXISTS store TEXT')
}

export async function backfillProcurementStores(): Promise<void> {
  await ensureProcurementStoreColumn()

  const rows = await query<{ id: string; link: string | null }>(
    `SELECT id, link FROM procurement_items
     WHERE (store IS NULL OR store = '') AND link IS NOT NULL AND link <> ''`,
  )

  for (const row of rows) {
    const store = detectStoreFromUrl(row.link ?? '')
    if (!store) continue
    await pool.query(`UPDATE procurement_items SET store = $1 WHERE id = $2`, [store, row.id])
  }
}
