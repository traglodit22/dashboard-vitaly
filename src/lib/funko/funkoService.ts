import { query } from '@/lib/db/index'
import { ensureFunkoSchema } from '@/lib/funko/ensureFunko'
import {
  ITEM_FROM_SQL,
  ITEM_SELECT_SQL,
  rowToCategory,
  rowToItem,
} from '@/lib/funko/mapRow'
import { parsePopNumber } from '@/lib/funko/parsePopNumber'
import type { FunkoCatalogStats, FunkoImportRow } from '@/lib/funko/types'

export interface ListFunkoOptions {
  categorySlug?: string
  owned?: boolean
  inTransit?: boolean
  search?: string
}

export async function listFunkoCategories() {
  await ensureFunkoSchema()
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM funko_categories ORDER BY sort_order ASC, name ASC',
  )
  return rows.map(rowToCategory)
}

export async function listFunkoItems(options: ListFunkoOptions = {}) {
  await ensureFunkoSchema()

  const clauses: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (options.categorySlug) {
    clauses.push(`c.slug = $${idx++}`)
    params.push(options.categorySlug)
  }
  if (options.owned === true) {
    clauses.push('i.owned = true')
  }
  if (options.inTransit === true) {
    clauses.push('i.in_transit = true')
  }
  if (options.search?.trim()) {
    clauses.push(`(i.title ILIKE $${idx} OR i.handle ILIKE $${idx})`)
    params.push(`%${options.search.trim()}%`)
    idx++
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const rows = await query<Record<string, unknown>>(
    `SELECT ${ITEM_SELECT_SQL} ${ITEM_FROM_SQL}
     ${where}
     ORDER BY i.sort_order ASC, i.title ASC`,
    params,
  )
  return rows.map(rowToItem)
}

export async function getFunkoStats(categorySlug?: string): Promise<FunkoCatalogStats> {
  await ensureFunkoSchema()

  const params: unknown[] = []
  let where = ''
  if (categorySlug) {
    where = 'WHERE c.slug = $1'
    params.push(categorySlug)
  }

  const rows = await query<{ total: string; owned: string; in_transit: string }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE i.owned)::text AS owned,
       COUNT(*) FILTER (WHERE i.in_transit)::text AS in_transit
     FROM funko_items i
     JOIN funko_categories c ON c.id = i.category_id
     ${where}`,
    params,
  )

  const row = rows[0]
  return {
    total: Number(row?.total ?? 0),
    owned: Number(row?.owned ?? 0),
    inTransit: Number(row?.in_transit ?? 0),
  }
}

export async function importFunkoRows(
  categorySlug: string,
  rows: FunkoImportRow[],
  options: { replace?: boolean } = {},
): Promise<{ imported: number; skipped: number }> {
  await ensureFunkoSchema()

  const category = await query<{ id: string }>(
    'SELECT id FROM funko_categories WHERE slug = $1',
    [categorySlug],
  )
  const categoryId = category[0]?.id
  if (!categoryId) throw new Error(`Категория «${categorySlug}» не найдена`)

  if (options.replace) {
    await query('DELETE FROM funko_items WHERE category_id = $1', [categoryId])
  } else {
    const existing = await query<{ cnt: string }>(
      'SELECT COUNT(*)::text AS cnt FROM funko_items WHERE category_id = $1',
      [categoryId],
    )
    if (Number(existing[0]?.cnt ?? 0) > 0) {
      return { imported: 0, skipped: rows.length }
    }
  }

  const BATCH = 50
  let imported = 0

  for (let offset = 0; offset < rows.length; offset += BATCH) {
    const batch = rows.slice(offset, offset + BATCH)
    const values: unknown[] = [categoryId]
    const tuples: string[] = []
    let idx = 2

    for (let i = 0; i < batch.length; i++) {
      const row = batch[i]
      const popNumber = parsePopNumber(row.title)
      tuples.push(
        `($1, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`,
      )
      values.push(
        row.handle,
        row.title,
        row.imageUrl || null,
        row.series,
        popNumber,
        i + offset,
      )
    }

    const inserted = await query<{ id: string }>(
      `INSERT INTO funko_items
        (category_id, handle, title, image_url, series, pop_number, sort_order)
       VALUES ${tuples.join(', ')}
       ON CONFLICT (category_id, handle) DO NOTHING
       RETURNING id`,
      values,
    )
    imported += inserted.length
  }

  return { imported, skipped: rows.length - imported }
}

export async function patchFunkoItem(
  id: string,
  patch: {
    owned?: boolean
    inTransit?: boolean
    hasDuplicates?: boolean
    quantity?: number
    notes?: string | null
    title?: string
  },
) {
  await ensureFunkoSchema()

  const setClauses: string[] = ['updated_at = NOW()']
  const values: unknown[] = []
  let idx = 1

  if (typeof patch.owned === 'boolean') {
    setClauses.push(`owned = $${idx++}`)
    values.push(patch.owned)
  }
  if (typeof patch.inTransit === 'boolean') {
    setClauses.push(`in_transit = $${idx++}`)
    values.push(patch.inTransit)
  }
  if (typeof patch.hasDuplicates === 'boolean') {
    setClauses.push(`has_duplicates = $${idx++}`)
    values.push(patch.hasDuplicates)
  }
  if (typeof patch.quantity === 'number') {
    setClauses.push(`quantity = $${idx++}`)
    values.push(Math.max(0, patch.quantity))
  }
  if (patch.notes !== undefined) {
    setClauses.push(`notes = $${idx++}`)
    values.push(patch.notes ? patch.notes.trim() : null)
  }
  if (typeof patch.title === 'string') {
    setClauses.push(`title = $${idx++}`)
    values.push(patch.title.trim())
    setClauses.push(`pop_number = $${idx++}`)
    values.push(parsePopNumber(patch.title.trim()))
  }

  if (setClauses.length === 1) {
    throw new Error('Нет полей для обновления')
  }

  values.push(id)
  const updated = await query<{ id: string }>(
    `UPDATE funko_items SET ${setClauses.join(', ')}
     WHERE id = $${idx}
     RETURNING id`,
    values,
  )

  if (!updated.length) return null

  const rows = await query<Record<string, unknown>>(
    `SELECT ${ITEM_SELECT_SQL} ${ITEM_FROM_SQL} WHERE i.id = $1`,
    [updated[0].id],
  )
  return rows[0] ? rowToItem(rows[0]) : null
}

export async function deleteFunkoItem(id: string): Promise<boolean> {
  await ensureFunkoSchema()
  const rows = await query<{ id: string }>(
    'DELETE FROM funko_items WHERE id = $1 RETURNING id',
    [id],
  )
  return rows.length > 0
}
