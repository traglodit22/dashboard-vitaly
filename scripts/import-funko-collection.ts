/**
 * Импорт коллекции из PDF (collection-*.json).
 *
 *   python3 scripts/extract-funko-pdf.py
 *   set -a && source .env && set +a && npm run import-funko-collection
 *   npm run import-funko-collection -- animation   # одна категория
 *
 * Правила: scripts/data/funko/IMPORT.md
 */
import { pool } from '../src/lib/db/index'
import { ensureFunkoSchema } from '../src/lib/funko/ensureFunko'
import {
  importAllFunkoCollections,
  importFunkoCollectionFromFile,
} from '../src/lib/funko/importCollection'

async function main() {
  await ensureFunkoSchema()

  const slug = process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1])

  if (slug) {
    const result = await importFunkoCollectionFromFile(slug)
    console.log(
      `${slug}: импорт ${result.imported}, обновлено ${result.updated}, с фото ${result.withImages}`,
    )
    return
  }

  const results = await importAllFunkoCollections()
  let imported = 0
  let updated = 0
  let withImages = 0

  for (const r of results) {
    console.log(
      `${r.slug}: ${r.total} из PDF → +${r.imported} новых, ${r.updated} обновлено, ${r.withImages} с фото`,
    )
    imported += r.imported
    updated += r.updated
    withImages += r.withImages
  }

  console.log(`\nИтого: +${imported} новых, ${updated} обновлено, ${withImages} с фото`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => pool.end())
