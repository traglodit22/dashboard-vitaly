import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { ensureFilesSeed, getCategoryBySlug } from '@/lib/files/ensureFilesSeed'
import { FILE_ITEM_FROM, FILE_ITEM_SELECT, rowToFileItem, rowToFileCategory } from '@/lib/files/mapRow'
import { uploadFileItem } from '@/lib/files/fileService'
import { resolveUploadMime, isImageMime, isPdfMime } from '@/lib/files/mimeDetect'
import { isThumbnailPreviewPath } from '@/lib/files/previewConstants'
import { schedulePreviewGenerationBatch } from '@/lib/files/previewQueue'
import type { FileStorageType } from '@/lib/files/types'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  await ensureFilesSeed()

  const { searchParams } = new URL(req.url)
  const categorySlug = searchParams.get('categorySlug')
  const folderId = searchParams.get('folderId')

  const conditions: string[] = []
  const values: unknown[] = []

  if (categorySlug) {
    values.push(categorySlug)
    conditions.push(`c.slug = $${values.length}`)
  }

  if (folderId) {
    values.push(folderId)
    conditions.push(`f.folder_id = $${values.length}`)
  } else if (categorySlug) {
    conditions.push('f.folder_id IS NULL')
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const rows = await query<Record<string, unknown>>(
    `SELECT ${FILE_ITEM_SELECT} ${FILE_ITEM_FROM}
     ${where}
     ORDER BY f.sort_order ASC, f.created_at DESC`,
    values,
  )

  const missingPreviewIds: string[] = []
  for (const row of rows) {
    const mime = row.mime_type as string
    const name = row.original_name as string
    if (
      !isThumbnailPreviewPath(row.preview_path as string | null, row.storage_path as string) &&
      (isImageMime(mime) || isPdfMime(mime, name))
    ) {
      missingPreviewIds.push(row.id as string)
    }
  }
  if (missingPreviewIds.length) {
    schedulePreviewGenerationBatch(missingPreviewIds)
  }

  return NextResponse.json({ items: rows.map(rowToFileItem) })
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  await ensureFilesSeed()

  const form = await req.formData()
  const categorySlug = String(form.get('categorySlug') ?? '').trim()
  const folderIdRaw = String(form.get('folderId') ?? '').trim()
  const folderId = folderIdRaw || null
  const titleRaw = String(form.get('title') ?? '').trim()
  const file = form.get('file')

  if (!categorySlug) {
    return NextResponse.json({ error: 'Укажите категорию' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Выберите файл' }, { status: 400 })
  }

  const categoryRow = await getCategoryBySlug(categorySlug)
  if (!categoryRow) {
    return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })
  }

  const category = rowToFileCategory(categoryRow)
  const buffer = Buffer.from(await file.arrayBuffer())
  let mime: string
  try {
    mime = resolveUploadMime(file.name, file.type || '')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
  const title = titleRaw || file.name.replace(/\.[^.]+$/, '')

  try {
    const item = await uploadFileItem({
      categoryId: category.id,
      categorySlug: category.slug,
      storageType: category.storageType as FileStorageType,
      folderId,
      title,
      originalName: file.name,
      mime,
      buffer,
    })
    if (!item) {
      return NextResponse.json({ error: 'Не удалось сохранить файл' }, { status: 500 })
    }
    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
