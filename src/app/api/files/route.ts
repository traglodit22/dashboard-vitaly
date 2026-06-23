import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { ensureFilesSeed, getCategoryBySlug } from '@/lib/files/ensureFilesSeed'
import { FILE_ITEM_FROM, FILE_ITEM_SELECT, rowToFileItem, rowToFileCategory } from '@/lib/files/mapRow'
import { uploadFileItem } from '@/lib/files/fileService'
import type { FileStorageType } from '@/lib/files/types'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  await ensureFilesSeed()

  const { searchParams } = new URL(req.url)
  const categorySlug = searchParams.get('categorySlug')

  const rows = await query<Record<string, unknown>>(
    `SELECT ${FILE_ITEM_SELECT} ${FILE_ITEM_FROM}
     ${categorySlug ? 'WHERE c.slug = $1' : ''}
     ORDER BY f.created_at DESC`,
    categorySlug ? [categorySlug] : [],
  )

  return NextResponse.json({ items: rows.map(rowToFileItem) })
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  await ensureFilesSeed()

  const form = await req.formData()
  const categorySlug = String(form.get('categorySlug') ?? '').trim()
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
  const mime = file.type || 'application/octet-stream'
  const title = titleRaw || file.name.replace(/\.[^.]+$/, '')

  try {
    const item = await uploadFileItem({
      categoryId: category.id,
      categorySlug: category.slug,
      storageType: category.storageType as FileStorageType,
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
