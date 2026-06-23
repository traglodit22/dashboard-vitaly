import { pool, query } from '@/lib/db/index'
import type { StatusColorKey } from '@/lib/procurement/statusColors'

export const DEFAULT_PROCUREMENT_STATUSES: { name: string; colorKey: StatusColorKey; sortOrder: number }[] = [
  { name: 'покупается', colorKey: 'red', sortOrder: 10 },
  { name: 'куплено', colorKey: 'green', sortOrder: 20 },
  { name: 'не нужно?', colorKey: 'white', sortOrder: 30 },
  { name: 'Рановато', colorKey: 'blue', sortOrder: 35 },
  { name: 'едет', colorKey: 'orange', sortOrder: 40 },
  { name: 'Дима', colorKey: 'gray', sortOrder: 50 },
  { name: 'тестируем', colorKey: 'purple', sortOrder: 60 },
]

const HIGHLIGHT_TO_STATUS_NAME: Record<string, string> = {
  red: 'покупается',
  green: 'куплено',
  yellow: 'едет',
  white: 'не нужно?',
  gray: 'Дима',
  purple: 'тестируем',
}

const STATUSES_DDL = `
CREATE TABLE IF NOT EXISTS procurement_statuses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES procurement_categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color_key   TEXT NOT NULL DEFAULT 'gray',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, name)
);

CREATE INDEX IF NOT EXISTS procurement_statuses_category_idx
  ON procurement_statuses (category_id, sort_order);
`

export async function ensureProcurementStatusesSchema(): Promise<void> {
  await pool.query(STATUSES_DDL)
  await pool.query(
    `ALTER TABLE procurement_items
     ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES procurement_statuses(id) ON DELETE SET NULL`,
  )
}

export async function seedDefaultStatusesForCategory(categoryId: string): Promise<void> {
  for (const s of DEFAULT_PROCUREMENT_STATUSES) {
    await pool.query(
      `INSERT INTO procurement_statuses (category_id, name, color_key, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (category_id, name) DO NOTHING`,
      [categoryId, s.name, s.colorKey, s.sortOrder],
    )
  }
}

async function migrateHighlightColorsToStatuses(): Promise<void> {
  const rows = await query<{
    id: string
    category_id: string
    highlight_color: string | null
  }>(
    `SELECT id, category_id, highlight_color FROM procurement_items
     WHERE status_id IS NULL AND highlight_color IS NOT NULL`,
  )

  for (const row of rows) {
    const statusName = HIGHLIGHT_TO_STATUS_NAME[row.highlight_color ?? '']
    if (!statusName) continue

    const statusRows = await query<{ id: string }>(
      `SELECT id FROM procurement_statuses
       WHERE category_id = $1 AND name = $2 LIMIT 1`,
      [row.category_id, statusName],
    )
    const statusId = statusRows[0]?.id
    if (!statusId) continue

    await pool.query(`UPDATE procurement_items SET status_id = $1 WHERE id = $2`, [
      statusId,
      row.id,
    ])
  }
}

export async function ensureAllCategoryStatuses(): Promise<void> {
  await ensureProcurementStatusesSchema()

  const categories = await query<{ id: string }>(`SELECT id FROM procurement_categories`)
  for (const c of categories) {
    await seedDefaultStatusesForCategory(c.id)
  }

  await migrateHighlightColorsToStatuses()
}
