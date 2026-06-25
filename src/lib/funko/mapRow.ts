import type { FunkoCategory, FunkoItem } from '@/lib/funko/types'

export function rowToCategory(row: Record<string, unknown>): FunkoCategory {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    sortOrder: Number(row.sort_order ?? 0),
  }
}

export function rowToItem(row: Record<string, unknown>): FunkoItem {
  const series = row.series
  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    categorySlug: (row.category_slug as string) ?? '',
    categoryName: (row.category_name as string) ?? '',
    handle: row.handle as string,
    title: row.title as string,
    imageUrl: (row.image_url as string) ?? null,
    series: Array.isArray(series) ? (series as string[]) : [],
    popNumber: row.pop_number != null ? Number(row.pop_number) : null,
    owned: Boolean(row.owned),
    inTransit: Boolean(row.in_transit),
    hasDuplicates: Boolean(row.has_duplicates),
    quantity: Number(row.quantity ?? 0),
    notes: (row.notes as string) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
  }
}

export const ITEM_SELECT_SQL = `
  i.*,
  c.slug AS category_slug,
  c.name AS category_name
`

export const ITEM_FROM_SQL = `
  FROM funko_items i
  JOIN funko_categories c ON c.id = i.category_id
`
