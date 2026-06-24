import { pool, query } from '@/lib/db/index'

const KLUB_CATEGORY = 'Клуб'

/** Категория «Клуб» — позиции заливаются скриптом import-klub-procurement.ts */
export async function ensureKlubProcurement(): Promise<void> {
  await pool.query(
    `INSERT INTO procurement_categories (name, sort_order)
     VALUES ($1, 30)
     ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
    [KLUB_CATEGORY],
  )

  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM procurement_items i
     JOIN procurement_categories c ON c.id = i.category_id
     WHERE c.name = $1`,
    [KLUB_CATEGORY],
  )
  if (Number(count) === 0) {
    console.warn(
      `[procurement] Категория «${KLUB_CATEGORY}» пуста — выполните: npx tsx scripts/import-klub-procurement.ts`,
    )
  }
}
