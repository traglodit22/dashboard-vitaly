/**
 * Импорт каталога Funko Pop из scripts/data/funko/*.json
 * (источник: kennymkchan/funko-pop-data, MIT).
 *
 *   npm run import-funko-catalog              # все категории
 *   npm run import-funko-catalog -- disney    # одна категория
 *   npm run import-funko-catalog -- --replace # перезаписать
 *
 * Пересобрать JSON из CSV:
 *   curl -sL .../funko_pop.csv -o /tmp/funko_pop.csv
 *   python3 scripts/extract-funko-catalogs.py /tmp/funko_pop.csv
 */
import { pool } from '../src/lib/db/index'
import { FUNKO_CATEGORY_DEFS, hasCatalogSource } from '../src/lib/funko/categoryConfig'
import { ensureFunkoSchema } from '../src/lib/funko/ensureFunko'
import { importFunkoRows } from '../src/lib/funko/funkoService'
import { loadCategoryImportRows } from '../src/lib/funko/loadCategoryData'

async function main() {
  await ensureFunkoSchema()

  const replace = process.argv.includes('--replace')
  const download = process.argv.includes('--download')
  const source = download ? 'download' : 'bundled'
  const slugArg = process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1])
  const targets = slugArg
    ? FUNKO_CATEGORY_DEFS.filter((d) => d.slug === slugArg)
    : FUNKO_CATEGORY_DEFS.filter(hasCatalogSource)

  if (slugArg && !targets.length) {
    console.error(`Неизвестная категория: ${slugArg}`)
    process.exit(1)
  }

  let importedTotal = 0
  for (const def of targets) {
    console.log(`\n=== ${def.name} (${def.slug}) ===`)
    const rows = await loadCategoryImportRows(def.slug, source)
    console.log(`Найдено ${rows.length} записей`)
    if (!rows.length) {
      console.log('Пропуск — нет данных')
      continue
    }
    const result = await importFunkoRows(def.slug, rows, { replace })
    importedTotal += result.imported
    console.log(
      result.imported > 0
        ? `Импортировано: ${result.imported}`
        : `Пропущено (каталог уже заполнен): ${result.skipped}. Используйте --replace`,
    )
  }

  console.log(`\nВсего импортировано: ${importedTotal}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => pool.end())
