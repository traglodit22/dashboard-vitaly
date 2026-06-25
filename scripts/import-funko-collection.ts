/**
 * Импорт коллекции Animation из PDF (collection-animation.json).
 *
 *   python3 scripts/extract-funko-pdf.py
 *   set -a && source .env && set +a && npm run import-funko-collection
 *
 * Правила: scripts/data/funko/IMPORT.md
 */
import { pool } from '../src/lib/db/index'
import { ensureFunkoSchema } from '../src/lib/funko/ensureFunko'
import { importFunkoCollectionFromFile } from '../src/lib/funko/importCollection'

async function main() {
  await ensureFunkoSchema()
  const result = await importFunkoCollectionFromFile()
  console.log(
    `Импортировано: ${result.imported}, с фото: ${result.withImages}`,
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => pool.end())
