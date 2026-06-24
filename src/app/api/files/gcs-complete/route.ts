import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { ensureFilesSeed, getCategoryBySlug } from '@/lib/files/ensureFilesSeed'
import { rowToFileCategory } from '@/lib/files/mapRow'
import {
  completeGcsDirectUpload,
  ensureFilePreview,
  fetchFileItem,
  fetchFileRow,
} from '@/lib/files/fileService'
import { isImageMime, isPdfMime, resolveUploadMime } from '@/lib/files/mimeDetect'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  await ensureFilesSeed()

  const body = await req.json()
  const fileId = String(body.fileId ?? '').trim()
  const categorySlug = String(body.categorySlug ?? '').trim()
  const folderId = body.folderId ? String(body.folderId) : null
  const fileName = String(body.fileName ?? '').trim()
  const sizeBytes = Number(body.size ?? 0)
  const titleRaw = String(body.title ?? '').trim()

  if (!fileId || !categorySlug || !fileName || !sizeBytes) {
    return NextResponse.json({ error: 'Неполные данные загрузки' }, { status: 400 })
  }

  const categoryRow = await getCategoryBySlug(categorySlug)
  if (!categoryRow) {
    return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })
  }

  const category = rowToFileCategory(categoryRow)
  if (category.storageType !== 'gcs') {
    return NextResponse.json({ error: 'Категория не использует облако' }, { status: 400 })
  }

  let mime: string
  try {
    mime = resolveUploadMime(fileName, String(body.mime ?? ''))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const title = titleRaw || fileName.replace(/\.[^.]+$/, '')

  try {
    let item = await completeGcsDirectUpload({
      fileId,
      categoryId: category.id,
      categorySlug: category.slug,
      folderId,
      title,
      originalName: fileName,
      mime,
      sizeBytes,
    })
    if (!item) {
      return NextResponse.json({ error: 'Не удалось сохранить файл' }, { status: 500 })
    }

    if (isImageMime(mime) || isPdfMime(mime, fileName)) {
      const row = await fetchFileRow(item.id)
      if (row) {
        try {
          if (isImageMime(mime)) {
            await ensureFilePreview(row)
            item = (await fetchFileItem(item.id)) ?? item
          } else {
            const fileId = item.id
            void ensureFilePreview(row).catch((err) => {
              console.error('[files] background PDF preview failed', fileId, err)
            })
          }
        } catch (err) {
          console.error('[files] preview after upload failed', err)
        }
      }
    }

    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
