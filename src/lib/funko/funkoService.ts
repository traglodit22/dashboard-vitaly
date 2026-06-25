import { query } from '@/lib/db/index'
import { getCategorySeriesLabel, isAllFunkoCategorySlug } from '@/lib/funko/categoryConfig'
import { applyFunkoCategoryOrder, getFunkoCategoryOrderKeys } from '@/lib/funko/categoryOrder'
import { enrichFunkoItems } from '@/lib/funko/enrichItem'
import { ensureFunkoSchema } from '@/lib/funko/ensureFunko'
import { deleteFunkoGcsImage } from '@/lib/funko/funkoImage'
import {
  ITEM_FROM_SQL,
  ITEM_SELECT_SQL,
  rowToCategory,
  rowToItem,
} from '@/lib/funko/mapRow'
import { parsePopNumber } from '@/lib/funko/parsePopNumber'
import type { FunkoCatalogStats, FunkoImportRow, FunkoListResult } from '@/lib/funko/types'

export const DEFAULT_PAGE_SIZE = 24

export interface ListFunkoOptions {
  categorySlug?: string
  owned?: boolean
  inTransit?: boolean
  search?: string
  page?: number
  pageSize?: number
}

function slugifyHandle(title: string, popNumber: number | null): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  const pop = popNumber ?? Date.now()
  return `manual-${pop}-${base || 'item'}`.slice(0, 120)
}

export async function listFunkoCategories() {
  await ensureFunkoSchema()
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM funko_categories ORDER BY sort_order ASC, name ASC',
  )
  const categories = rows.map(rowToCategory)
  const order = await getFunkoCategoryOrderKeys()
  return applyFunkoCategoryOrder(categories, order)
}

export async function listFunkoItems(
  options: ListFunkoOptions = {},
): Promise<FunkoListResult> {
  await ensureFunkoSchema()

  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE))
  const page = Math.max(1, options.page ?? 1)
  const offset = (page - 1) * pageSize

  const clauses: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (options.categorySlug && !isAllFunkoCategorySlug(options.categorySlug)) {
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
    clauses.push(`(i.title ILIKE $${idx} OR i.handle ILIKE $${idx} OR i.notes ILIKE $${idx})`)
    params.push(`%${options.search.trim()}%`)
    idx++
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const countRows = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM funko_items i
     JOIN funko_categories c ON c.id = i.category_id
     ${where}`,
    params,
  )
  const total = Number(countRows[0]?.total ?? 0)

  const rows = await query<Record<string, unknown>>(
    `SELECT ${ITEM_SELECT_SQL} ${ITEM_FROM_SQL}
     ${where}
     ORDER BY i.sort_order ASC, i.title ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, pageSize, offset],
  )

  const items = await enrichFunkoItems(rows)
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getFunkoItemById(id: string) {
  await ensureFunkoSchema()
  const rows = await query<Record<string, unknown>>(
    `SELECT ${ITEM_SELECT_SQL} ${ITEM_FROM_SQL} WHERE i.id = $1`,
    [id],
  )
  if (!rows[0]) return null
  const { enrichFunkoItem } = await import('@/lib/funko/enrichItem')
  return enrichFunkoItem(rows[0])
}

export async function getFunkoStats(categorySlug?: string): Promise<FunkoCatalogStats> {
  await ensureFunkoSchema()

  const params: unknown[] = []
  let where = ''
  if (categorySlug && !isAllFunkoCategorySlug(categorySlug)) {
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

export async function createFunkoItem(input: {
  categorySlug: string
  title: string
  popNumber?: number | null
  subseries?: string
  notes?: string | null
  owned?: boolean
  inTransit?: boolean
  hasDuplicates?: boolean
  quantity?: number
}) {
  await ensureFunkoSchema()

  const title = input.title.trim()
  if (!title) throw new Error('Укажите название')

  const categories = await query<{ id: string }>(
    'SELECT id FROM funko_categories WHERE slug = $1',
    [input.categorySlug],
  )
  const categoryId = categories[0]?.id
  if (!categoryId) throw new Error('Категория не найдена')

  const popNumber =
    input.popNumber !== undefined && input.popNumber !== null
      ? input.popNumber
      : parsePopNumber(title)

  const seriesLabel = getCategorySeriesLabel(input.categorySlug)
  const series = input.subseries?.trim()
    ? [input.subseries.trim(), seriesLabel]
    : [seriesLabel]

  let handle = slugifyHandle(title, popNumber)
  const existing = await query<{ id: string }>(
    'SELECT id FROM funko_items WHERE category_id = $1 AND handle = $2',
    [categoryId, handle],
  )
  if (existing.length) {
    handle = `${handle}-${Date.now().toString(36)}`.slice(0, 120)
  }

  const sortRows = await query<{ max: number | null }>(
    'SELECT MAX(sort_order) AS max FROM funko_items WHERE category_id = $1',
    [categoryId],
  )
  const sortOrder = Number(sortRows[0]?.max ?? 0) + 10

  const inserted = await query<Record<string, unknown>>(
    `INSERT INTO funko_items
      (category_id, handle, title, series, pop_number, owned, in_transit,
       has_duplicates, quantity, notes, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      categoryId,
      handle,
      title,
      series,
      popNumber,
      Boolean(input.owned),
      Boolean(input.inTransit),
      Boolean(input.hasDuplicates),
      Math.max(0, input.quantity ?? 0),
      input.notes?.trim() || null,
      sortOrder,
    ],
  )

  return getFunkoItemById(inserted[0].id as string)
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
    const existing = await query<{ image_gcs_key: string | null }>(
      'SELECT image_gcs_key FROM funko_items WHERE category_id = $1',
      [categoryId],
    )
    for (const row of existing) {
      await deleteFunkoGcsImage(row.image_gcs_key)
    }
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
    popNumber?: number | null
    subseries?: string | null
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
  }
  if (patch.popNumber !== undefined) {
    setClauses.push(`pop_number = $${idx++}`)
    values.push(patch.popNumber)
  }
  if (patch.subseries !== undefined) {
    const rows = await query<{ slug: string }>(
      `SELECT c.slug FROM funko_items i
       JOIN funko_categories c ON c.id = i.category_id
       WHERE i.id = $1`,
      [id],
    )
    const seriesLabel = getCategorySeriesLabel(rows[0]?.slug ?? 'animation')
    const series = patch.subseries?.trim()
      ? [patch.subseries.trim(), seriesLabel]
      : [seriesLabel]
    setClauses.push(`series = $${idx++}`)
    values.push(series)
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
  return getFunkoItemById(updated[0].id)
}

export async function deleteFunkoItem(id: string): Promise<boolean> {
  await ensureFunkoSchema()
  const rows = await query<{ image_gcs_key: string | null }>(
    'SELECT image_gcs_key FROM funko_items WHERE id = $1',
    [id],
  )
  if (!rows.length) return false
  await deleteFunkoGcsImage(rows[0].image_gcs_key)
  await query('DELETE FROM funko_items WHERE id = $1', [id])
  return true
}
