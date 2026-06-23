import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { ensureFilesSeed, getCategoryBySlug } from '@/lib/files/ensureFilesSeed'
import { rowToFileCategory } from '@/lib/files/mapRow'
import { prepareGcsDirectUpload } from '@/lib/files/fileService'
import { resolveUploadMime } from '@/lib/files/mimeDetect'
import { isGcsConfigured } from '@/lib/files/gcsStorage'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  await ensureFilesSeed()

  if (!isGcsConfigured()) {
    return NextResponse.json({ error: 'Google Cloud Storage не настроен' }, { status: 503 })
  }

  const body = await req.json()
  const categorySlug = String(body.categorySlug ?? '').trim()
  const folderId = body.folderId ? String(body.folderId) : null
  const fileName = String(body.fileName ?? '').trim()
  const sizeBytes = Number(body.size ?? 0)

  if (!categorySlug || !fileName || !sizeBytes) {
    return NextResponse.json({ error: 'Укажите категорию, имя и размер файла' }, { status: 400 })
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

  try {
    const prepared = await prepareGcsDirectUpload({
      categorySlug,
      folderId,
      originalName: fileName,
      mime,
      sizeBytes,
    })
    return NextResponse.json({
      fileId: prepared.fileId,
      uploadUrl: prepared.uploadUrl,
      mime: prepared.mime,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
