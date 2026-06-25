import { query } from '@/lib/db/index'
import { ensureFunkoSchema } from '@/lib/funko/ensureFunko'
import {
  collectionHandle,
  loadCollectionJson,
  matchCatalogImage,
  type CollectionImportRow,
} from '@/lib/funko/matchCatalogImage'

export async function importFunkoCollection(
  rows: CollectionImportRow[],
): Promise<{ imported: number; withImages: number }> {
  await ensureFunkoSchema()

  const category = await query<{ id: string }>(
    "SELECT id FROM funko_categories WHERE slug = 'animation'",
  )
  const categoryId = category[0]?.id
  if (!categoryId) throw new Error('Категория animation не найдена')

  await query('DELETE FROM funko_items WHERE category_id = $1', [categoryId])

  const BATCH = 25
  let imported = 0
  let withImages = 0

  for (let offset = 0; offset < rows.length; offset += BATCH) {
    const batch = rows.slice(offset, offset + BATCH)
    const values: unknown[] = [categoryId]
    const tuples: string[] = []
    let idx = 2

    for (let i = 0; i < batch.length; i++) {
      const row = batch[i]
      const globalIndex = offset + i
      const handle = collectionHandle(row, globalIndex)
      const imageUrl = (await matchCatalogImage(row)) ?? null
      if (imageUrl) withImages++

      const series = row.subseries ? [row.subseries, 'Pop! Animation'] : ['Pop! Animation']

      tuples.push(
        `($1, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`,
      )
      values.push(
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
        row.sortOrder ?? globalIndex,
      )
    }

    const inserted = await query<{ id: string }>(
      `INSERT INTO funko_items
        (category_id, handle, title, image_url, series, pop_number,
         owned, in_transit, has_duplicates, quantity, notes, sort_order)
       VALUES ${tuples.join(', ')}
       RETURNING id`,
      values,
    )
    imported += inserted.length
  }

  return { imported, withImages }
}

export async function importFunkoCollectionFromFile(): Promise<{
  imported: number
  withImages: number
}> {
  const rows = await loadCollectionJson()
  return importFunkoCollection(rows)
}
