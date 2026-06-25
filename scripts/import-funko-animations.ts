/**
 * Импорт каталога Pop! Animation из scripts/data/funko/animations.json
 * (источник: kennymkchan/funko-pop-data, MIT).
 *
 *   set -a && source .env && set +a && npm run import-funko
 *
 * Пересобрать JSON из CSV:
 *   curl -sL .../funko_pop.csv | python3 scripts/extract-funko-animations.py
 */
import { pool } from '../src/lib/db/index'
import { ensureFunkoSchema } from '../src/lib/funko/ensureFunko'
import { importFunkoRows } from '../src/lib/funko/funkoService'
import { loadAnimationImportRows } from '../src/lib/funko/loadAnimationData'

async function main() {
  await ensureFunkoSchema()

  const replace = process.argv.includes('--replace')
  const source = process.argv.includes('--download') ? 'download' : 'bundled'

  console.log(`Загрузка Pop! Animation (${source})…`)
  const rows = await loadAnimationImportRows(source)
  console.log(`Найдено ${rows.length} записей`)

  const result = await importFunkoRows('animation', rows, { replace })
  console.log(
    result.imported > 0
      ? `Импортировано: ${result.imported}`
      : `Пропущено (каталог уже заполнен): ${result.skipped}. Используйте --replace для перезаписи.`,
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => pool.end())
