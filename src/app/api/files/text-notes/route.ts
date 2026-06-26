import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { ensureFilesSeed, getCategoryBySlug } from '@/lib/files/ensureFilesSeed'
import { createTextNoteItem } from '@/lib/files/fileService'
import { rowToFileCategory } from '@/lib/files/mapRow'
import { isGcsConfigured } from '@/lib/files/gcsStorage'
import type { FileStorageType } from '@/lib/files/types'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  await ensureFilesSeed()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
  }

  const categorySlug = String(body.categorySlug ?? '').trim()
  const folderIdRaw = String(body.folderId ?? '').trim()
  const folderId = folderIdRaw || null
  const title = String(body.title ?? '').trim()
  const content = typeof body.content === 'string' ? body.content : ''

  if (!categorySlug) {
    return NextResponse.json({ error: 'Укажите категорию' }, { status: 400 })
  }
  if (!title) {
    return NextResponse.json({ error: 'Укажите название заметки' }, { status: 400 })
  }

  const categoryRow = await getCategoryBySlug(categorySlug)
  if (!categoryRow) {
    return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })
  }

  const category = rowToFileCategory(categoryRow)
  if (category.storageType === 'gcs' && !isGcsConfigured()) {
    return NextResponse.json({ error: 'Google Cloud Storage не настроен' }, { status: 503 })
  }

  try {
    const result = await createTextNoteItem({
      categoryId: category.id,
      categorySlug: category.slug,
      storageType: category.storageType as FileStorageType,
      folderId,
      title,
      content,
    })
    return NextResponse.json(
      { item: result.item, duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
