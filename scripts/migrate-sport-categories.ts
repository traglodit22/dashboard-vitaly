/**
 * Удаляет категорию sport, создаёт спортивные линейки, импортирует каталоги,
 * сбрасывает порядок категорий по алфавиту.
 *
 *   set -a && source .env && set +a && npm run migrate-sport-categories
 */
import { pool, query } from '../src/lib/db/index'
import {
  DEFAULT_FUNKO_CATEGORY_ORDER,
  FUNKO_CATEGORY_DEFS,
  hasCatalogSource,
} from '../src/lib/funko/categoryConfig'
import { saveFunkoCategoryOrder } from '../src/lib/funko/categoryOrder'
import { ensureFunkoSchema } from '../src/lib/funko/ensureFunko'
import { deleteFunkoGcsImage } from '../src/lib/funko/funkoImage'
import { importFunkoRows } from '../src/lib/funko/funkoService'
import { loadCategoryImportRows } from '../src/lib/funko/loadCategoryData'

const NEW_SPORTS_SLUGS = [
  'sports-legends',
  'basketball',
  'boxing',
  'football',
  'hockey',
  'mlb',
  'nba-mascots',
  'snl',
  'ufc',
  'tennis',
  'wwe',
]

async function removeSportCategory(): Promise<void> {
  const cat = await query<{ id: string }>(
    "SELECT id FROM funko_categories WHERE slug = 'sport'",
  )
  if (!cat[0]) {
    console.log('Категория sport не найдена — пропуск удаления')
    return
  }

  const categoryId = cat[0].id
  const images = await query<{ image_gcs_key: string | null }>(
    'SELECT image_gcs_key FROM funko_items WHERE category_id = $1',
    [categoryId],
  )
  for (const row of images) {
    await deleteFunkoGcsImage(row.image_gcs_key)
  }

  const deleted = await query<{ id: string }>(
    'DELETE FROM funko_items WHERE category_id = $1 RETURNING id',
    [categoryId],
  )
  console.log(`Удалено позиций sport: ${deleted.length}`)

  await query("DELETE FROM funko_categories WHERE slug = 'sport'")
  console.log('Категория sport удалена')
}

async function main(): Promise<void> {
  await removeSportCategory()
  await ensureFunkoSchema()

  const order = await saveFunkoCategoryOrder([...DEFAULT_FUNKO_CATEGORY_ORDER])
  console.log(`Порядок категорий (${order.length}): ${order.slice(0, 5).join(', ')}…`)

  let importedTotal = 0
  for (const slug of NEW_SPORTS_SLUGS) {
    const def = FUNKO_CATEGORY_DEFS.find((d) => d.slug === slug)
    if (!def) continue

    if (!hasCatalogSource(def)) {
      console.log(`${slug}: пустой каталог (нет данных в CSV)`)
      continue
    }

    const rows = await loadCategoryImportRows(slug, 'bundled')
    if (!rows.length) {
      console.log(`${slug}: 0 записей в JSON`)
      continue
    }

    const result = await importFunkoRows(slug, rows, { replace: true })
    importedTotal += result.imported
    console.log(`${slug}: импортировано ${result.imported}`)
  }

  console.log(`\nВсего импортировано в спортивные категории: ${importedTotal}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => pool.end())
