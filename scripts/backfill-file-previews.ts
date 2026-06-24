/**
 * Массовая генерация WebP-превью для уже загруженных файлов.
 *
 * На VPS:
 *   cd /var/www/dashboard && set -a && source .env && set +a && npm run backfill-previews
 *
 * Опции:
 *   --images-only  только изображения (без PDF)
 *   --limit N  обработать не больше N файлов
 *   --force    пересоздать даже если превью уже есть (только фото без --pdf)
 */
import { query } from '../src/lib/db/index'
import { ensureFilePreview } from '../src/lib/files/fileService'
import { FILE_ITEM_FROM, FILE_ITEM_SELECT } from '../src/lib/files/mapRow'
import { isImageMime, isPdfMime } from '../src/lib/files/mimeDetect'
import { isThumbnailPreviewPath } from '../src/lib/files/previewConstants'

const args = process.argv.slice(2)
const includePdf = !args.includes('--images-only')
const force = args.includes('--force')
const dryRun = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0

function needsPreview(row: Record<string, unknown>): boolean {
  const mime = row.mime_type as string
  const name = row.original_name as string
  const isImg = isImageMime(mime)
  const isPdf = includePdf && isPdfMime(mime, name)
  if (!isImg && !isPdf) return false
  if (force && isImg) return true
  if (force && isPdf) return true
  return !isThumbnailPreviewPath(
    row.preview_path as string | null,
    row.storage_path as string,
  )
}

async function main(): Promise<void> {
  const rows = await query<Record<string, unknown>>(
    `SELECT ${FILE_ITEM_SELECT} ${FILE_ITEM_FROM}
     ORDER BY f.created_at ASC`,
  )

  const pending = rows.filter(needsPreview)
  const targets = limit > 0 ? pending.slice(0, limit) : pending

  console.log(`Всего файлов: ${rows.length}`)
  console.log(`Без превью: ${pending.length} (обработаем: ${targets.length})`)
  if (!includePdf) console.log('Только изображения (без --images-only будут и PDF)')

  if (dryRun) {
    for (const row of targets) {
      console.log(`- ${row.id} ${row.original_name} (${row.mime_type})`)
    }
    return
  }

  let ok = 0
  let fail = 0

  for (let i = 0; i < targets.length; i++) {
    const row = targets[i]
    const label = `${row.original_name} (${row.id})`
    process.stdout.write(`[${i + 1}/${targets.length}] ${label}… `)
    try {
      if (force) {
        await query(
          'UPDATE file_items SET preview_path = NULL, updated_at = NOW() WHERE id = $1',
          [row.id as string],
        )
        row.preview_path = null
      }
      const buf = await ensureFilePreview(row)
      if (buf) {
        ok += 1
        console.log('ok')
      } else {
        fail += 1
        console.log('skip')
      }
    } catch (err) {
      fail += 1
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`fail: ${msg}`)
    }
  }

  console.log(`\nГотово: ${ok} ok, ${fail} fail`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
