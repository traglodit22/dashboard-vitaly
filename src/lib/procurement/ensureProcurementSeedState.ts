import { pool, query } from '@/lib/db/index'

const SEED_STATE_DDL = `
CREATE TABLE IF NOT EXISTS procurement_seed_state (
  category_name TEXT PRIMARY KEY,
  seeded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

export async function ensureProcurementSeedStateSchema(): Promise<void> {
  await pool.query(SEED_STATE_DDL)
}

export async function isCategorySeeded(categoryName: string): Promise<boolean> {
  const rows = await query<{ seeded: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM procurement_seed_state WHERE category_name = $1
     ) AS seeded`,
    [categoryName],
  )
  return rows[0]?.seeded ?? false
}

export async function markCategorySeeded(categoryName: string): Promise<void> {
  await pool.query(
    `INSERT INTO procurement_seed_state (category_name)
     VALUES ($1)
     ON CONFLICT (category_name) DO NOTHING`,
    [categoryName],
  )
}

/** Категории с данными помечаем как уже залитые — повторный seed запрещён. */
export async function backfillProcurementSeedState(): Promise<void> {
  await ensureProcurementSeedStateSchema()
  await pool.query(
    `INSERT INTO procurement_seed_state (category_name, seeded_at)
     SELECT c.name, NOW()
     FROM procurement_categories c
     WHERE EXISTS (SELECT 1 FROM procurement_items i WHERE i.category_id = c.id)
     ON CONFLICT (category_name) DO NOTHING`,
  )
}

export async function runCategorySeedOnce(
  categoryName: string,
  seedSql: string,
): Promise<void> {
  await ensureProcurementSeedStateSchema()

  if (await isCategorySeeded(categoryName)) return

  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM procurement_items i
     JOIN procurement_categories c ON c.id = i.category_id
     WHERE c.name = $1`,
    [categoryName],
  )

  if (Number(count) > 0) {
    await markCategorySeeded(categoryName)
    return
  }

  await pool.query(seedSql)
  await markCategorySeeded(categoryName)
}
