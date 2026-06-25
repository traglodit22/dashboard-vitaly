import { query } from '@/lib/db/index'
import { getCategorySeriesLabel } from '@/lib/funko/categoryConfig'
import { ensureFunkoSchema } from '@/lib/funko/ensureFunko'
import { deleteFunkoGcsImage } from '@/lib/funko/funkoImage'
import {
  collectionHandle,
  listCollectionSlugs,
  loadCollectionJson,
  matchCatalogImage,
  type CollectionImportRow,
} from '@/lib/funko/matchCatalogImage'

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

interface ExistingItem {
  id: string
  title: string
  popNumber: number | null
  imageUrl: string | null
  imageGcsKey: string | null
}

async function loadExistingItems(categoryId: string): Promise<ExistingItem[]> {
  const rows = await query<ExistingItem>(
    `SELECT id, title, pop_number AS "popNumber", image_url AS "imageUrl", image_gcs_key AS "imageGcsKey"
     FROM funko_items WHERE category_id = $1`,
    [categoryId],
  )
  return rows
}

function findExistingItem(items: ExistingItem[], row: CollectionImportRow): ExistingItem | null {
  const full = norm([row.subseries, row.name].filter(Boolean).join(' '))
  const name = norm(row.name || '')

  if (row.popNumber != null) {
    const byPop = items.filter((i) => i.popNumber === row.popNumber)
    if (byPop.length === 1) return byPop[0]
    if (byPop.length > 1 && name) {
      return (
        byPop.find((i) => norm(i.title).includes(name) || full && norm(i.title).includes(full)) ??
        byPop[0]
      )
    }
    if (byPop.length > 1) return byPop[0]
  }

  if (name) {
    const hit = items.find(
      (i) =>
        norm(i.title).includes(name) ||
        (full.length > 3 && norm(i.title).includes(full)),
    )
    if (hit) return hit
  }

  if (full.length > 3) {
    return items.find((i) => norm(i.title) === full) ?? null
  }

  return null
}

async function clearCategory(categoryId: string): Promise<void> {
  const existing = await query<{ image_gcs_key: string | null }>(
    'SELECT image_gcs_key FROM funko_items WHERE category_id = $1',
    [categoryId],
  )
  for (const row of existing) {
    await deleteFunkoGcsImage(row.image_gcs_key)
  }
  await query('DELETE FROM funko_items WHERE category_id = $1', [categoryId])
}

export async function importFunkoCollectionForCategory(
  categorySlug: string,
  rows: CollectionImportRow[],
  mode: 'replace' | 'merge' = 'merge',
): Promise<{ imported: number; updated: number; withImages: number }> {
  await ensureFunkoSchema()

  const category = await query<{ id: string }>(
    'SELECT id FROM funko_categories WHERE slug = $1',
    [categorySlug],
  )
  const categoryId = category[0]?.id
  if (!categoryId) throw new Error(`Категория «${categorySlug}» не найдена`)

  const seriesLabel = getCategorySeriesLabel(categorySlug)

  if (mode === 'replace') {
    await clearCategory(categoryId)
  }

  const existing = mode === 'merge' ? await loadExistingItems(categoryId) : []
  const unmatched = [...existing]

  let imported = 0
  let updated = 0
  let withImages = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const handle = collectionHandle(row, i)
    const series = row.subseries ? [row.subseries, seriesLabel] : [seriesLabel]
    const imageFromCatalog = (await matchCatalogImage(row, categorySlug)) ?? null

    const match = mode === 'merge' ? findExistingItem(unmatched, row) : null
    if (match) {
      const idx = unmatched.findIndex((m) => m.id === match.id)
      if (idx >= 0) unmatched.splice(idx, 1)

      const imageUrl =
        match.imageGcsKey ? match.imageUrl : imageFromCatalog ?? match.imageUrl

      await query(
        `UPDATE funko_items SET
           owned = $2,
           in_transit = $3,
           has_duplicates = $4,
           quantity = $5,
           notes = $6,
           series = $7,
           sort_order = $8,
           updated_at = NOW(),
           image_url = COALESCE(image_url, $9)
         WHERE id = $1`,
        [
          match.id,
          row.owned,
          row.inTransit,
          row.hasDuplicates,
          row.quantity ?? 0,
          row.notes,
          series,
          row.sortOrder ?? i,
          imageUrl,
        ],
      )
      if (imageUrl) withImages++
      updated++
      continue
    }

    const imageUrl = imageFromCatalog
    if (imageUrl) withImages++

    await query(
      `INSERT INTO funko_items
        (category_id, handle, title, image_url, series, pop_number,
         owned, in_transit, has_duplicates, quantity, notes, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (category_id, handle) DO UPDATE SET
         owned = EXCLUDED.owned,
         in_transit = EXCLUDED.in_transit,
         has_duplicates = EXCLUDED.has_duplicates,
         quantity = EXCLUDED.quantity,
         notes = EXCLUDED.notes,
         series = EXCLUDED.series,
         sort_order = EXCLUDED.sort_order,
         image_url = COALESCE(funko_items.image_url, EXCLUDED.image_url),
         updated_at = NOW()`,
      [
        categoryId,
        handle,
        row.title,
        imageUrl,
        series,
        row.popNumber,
        row.owned,
        row.inTransit,
        row.hasDuplicates,
        row.quantity ?? 0,
        row.notes,
        row.sortOrder ?? i,
      ],
    )
    imported++
  }

  return { imported, updated, withImages }
}

export async function importFunkoCollectionFromFile(
  categorySlug = 'animation',
): Promise<{ imported: number; updated: number; withImages: number }> {
  const rows = await loadCollectionJson(categorySlug)
  const mode = categorySlug === 'animation' ? 'replace' : 'merge'
  return importFunkoCollectionForCategory(categorySlug, rows, mode)
}

export async function importAllFunkoCollections(): Promise<
  {
    slug: string
    imported: number
    updated: number
    withImages: number
    total: number
  }[]
> {
  const slugs = await listCollectionSlugs()
  const results = []

  for (const slug of slugs) {
    let rows: CollectionImportRow[]
    try {
      rows = await loadCollectionJson(slug)
    } catch {
      continue
    }
    if (!rows.length) continue

    const mode = slug === 'animation' ? 'replace' : 'merge'
    const result = await importFunkoCollectionForCategory(slug, rows, mode)
    results.push({ slug, ...result, total: rows.length })
  }

  return results
}

/** @deprecated */
export async function importFunkoCollection(rows: CollectionImportRow[]) {
  return importFunkoCollectionForCategory('animation', rows, 'replace')
}
