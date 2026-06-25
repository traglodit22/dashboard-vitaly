import { query } from '@/lib/db/index'
import {
  DEFAULT_FUNKO_CATEGORY_ORDER,
  FUNKO_CATEGORY_DEFS,
} from '@/lib/funko/categoryConfig'
import { orderFunkoCategories, sanitizeFunkoCategoryOrder } from '@/lib/funko/orderCategories'
import type { FunkoCategory } from '@/lib/funko/types'

const VALID_SLUGS = new Set(FUNKO_CATEGORY_DEFS.map((d) => d.slug))

export async function getFunkoCategoryOrderKeys(): Promise<string[]> {
  try {
    const rows = await query<{ funko_category_order: string[] | null }>(
      'SELECT funko_category_order FROM system_settings WHERE id = 1',
    )
    const saved = sanitizeFunkoCategoryOrder(rows[0]?.funko_category_order, VALID_SLUGS)
    if (saved?.length) return saved
  } catch (err) {
    console.error('[funko] read category order failed:', err)
  }
  return [...DEFAULT_FUNKO_CATEGORY_ORDER]
}

export function applyFunkoCategoryOrder(
  categories: FunkoCategory[],
  order: string[],
): FunkoCategory[] {
  return orderFunkoCategories(categories, order)
}

export async function saveFunkoCategoryOrder(order: unknown): Promise<string[]> {
  const sanitized =
    sanitizeFunkoCategoryOrder(order, VALID_SLUGS) ?? [...DEFAULT_FUNKO_CATEGORY_ORDER]

  const complete: string[] = [...sanitized]
  for (const def of FUNKO_CATEGORY_DEFS) {
    if (!complete.includes(def.slug)) complete.push(def.slug)
  }

  await query(
    'UPDATE system_settings SET funko_category_order = $1, updated_at = NOW() WHERE id = 1',
    [complete],
  )

  // Синхронизировать sort_order в funko_categories
  for (let i = 0; i < complete.length; i++) {
    await query('UPDATE funko_categories SET sort_order = $1 WHERE slug = $2', [
      (i + 1) * 10,
      complete[i],
    ])
  }

  return complete
}
