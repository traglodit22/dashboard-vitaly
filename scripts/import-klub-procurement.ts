/**
 * Импорт категории «Клуб» из scripts/data/klub/ (JSON + PNG).
 * Запуск: npx tsx scripts/import-klub-procurement.ts
 * Пересоздать данные из PDF: python3 scripts/extract-klub-pdf.py
 */
import fs from 'fs/promises'
import path from 'path'
import { pool, query } from '../src/lib/db/index'
import { ensureHotelProcurement } from '../src/lib/procurement/ensureHotelSeed'
import { saveItemImageFile } from '../src/lib/procurement/itemImage'

const DATA_DIR = path.join(process.cwd(), 'scripts/data/klub')
const CATEGORY_NAME = 'Клуб'
const CATEGORY_SORT = 30

interface KlubRow {
  row_type: 'item' | 'type'
  name: string
  group_name: string | null
  need_qty: number
  have_qty: number
  in_transit_qty: number
  notes: string | null
  link: string | null
  sort_order: number
  image_file: string | null
}

async function main() {
  await ensureHotelProcurement()

  const jsonPath = path.join(DATA_DIR, 'items.json')
  const raw = await fs.readFile(jsonPath, 'utf8')
  const rows = JSON.parse(raw) as KlubRow[]

  const existing = await query<{ id: string; cnt: string }>(
    `SELECT c.id, COUNT(i.id)::text AS cnt
     FROM procurement_categories c
     LEFT JOIN procurement_items i ON i.category_id = c.id
     WHERE c.name = $1
     GROUP BY c.id`,
    [CATEGORY_NAME],
  )

  if (existing[0] && Number(existing[0].cnt) > 0) {
    console.log(`Категория «${CATEGORY_NAME}» уже содержит ${existing[0].cnt} позиций — пропуск.`)
    console.log('Для повторного импорта удалите категорию вручную.')
    process.exit(0)
  }

  let categoryId = existing[0]?.id as string | undefined
  if (!categoryId) {
    const inserted = await query<{ id: string }>(
      `INSERT INTO procurement_categories (name, sort_order)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order
       RETURNING id`,
      [CATEGORY_NAME, CATEGORY_SORT],
    )
    categoryId = inserted[0].id
    console.log(`Создана категория «${CATEGORY_NAME}»`)
  }

  let currentGroup: string | null = null
  let imported = 0
  let images = 0

  for (const row of rows) {
    if (row.row_type === 'type') {
      currentGroup = row.name
      const typeRows = await query<{ id: string }>(
        `INSERT INTO procurement_items
          (category_id, group_name, name, need_qty, have_qty, in_transit_qty, row_type, sort_order)
         VALUES ($1, NULL, $2, 0, 0, 0, 'type', $3)
         RETURNING id`,
        [categoryId, row.name, row.sort_order],
      )
      console.log(`  [type] ${row.name}`)
      void typeRows
      continue
    }

    const inserted = await query<{ id: string }>(
      `INSERT INTO procurement_items
        (category_id, group_name, name, need_qty, have_qty, in_transit_qty, notes, link, row_type, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'item', $9)
       RETURNING id`,
      [
        categoryId,
        currentGroup,
        row.name,
        row.need_qty,
        row.have_qty,
        row.in_transit_qty,
        row.notes,
        row.link,
        row.sort_order,
      ],
    )
    const itemId = inserted[0].id
    imported += 1

    if (row.image_file) {
      const imgPath = path.join(DATA_DIR, 'images', row.image_file)
      const buffer = await fs.readFile(imgPath)
      await saveItemImageFile(itemId, buffer, 'image/png')
      await query(
        `UPDATE procurement_items
         SET image_mime = 'image/png', image_updated_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [itemId],
      )
      images += 1
    }
  }

  console.log(`Готово: ${imported} позиций, ${images} фото в «${CATEGORY_NAME}».`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
