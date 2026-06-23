import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { ensureFilesSeed, getCategoryBySlug } from '@/lib/files/ensureFilesSeed'
import { rowToFileCategory } from '@/lib/files/mapRow'
import {
  createFolder,
  getFolderBreadcrumb,
  listFolders,
} from '@/lib/files/folderService'
import type { FileStorageType } from '@/lib/files/types'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  await ensureFilesSeed()

  const { searchParams } = new URL(req.url)
  const categorySlug = searchParams.get('categorySlug')
  const parentId = searchParams.get('parentId')
  const breadcrumbFolderId = searchParams.get('breadcrumbFor')

  if (!categorySlug) {
    return NextResponse.json({ error: 'Укажите categorySlug' }, { status: 400 })
  }

  const categoryRow = await getCategoryBySlug(categorySlug)
  if (!categoryRow) {
    return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })
  }

  const category = rowToFileCategory(categoryRow)

  if (breadcrumbFolderId) {
    const breadcrumb = await getFolderBreadcrumb(breadcrumbFolderId)
    return NextResponse.json({ breadcrumb })
  }

  const folders = await listFolders(category.id, parentId || null)
  return NextResponse.json({ folders })
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  await ensureFilesSeed()

  const body = await req.json()
  const categorySlug = String(body.categorySlug ?? '').trim()
  const name = String(body.name ?? '').trim()
  const parentId = body.parentId ? String(body.parentId) : null

  if (!categorySlug || !name) {
    return NextResponse.json({ error: 'Укажите категорию и название' }, { status: 400 })
  }

  const categoryRow = await getCategoryBySlug(categorySlug)
  if (!categoryRow) {
    return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })
  }

  const category = rowToFileCategory(categoryRow)

  try {
    const folder = await createFolder({
      categoryId: category.id,
      categorySlug: category.slug,
      storageType: category.storageType as FileStorageType,
      parentId,
      name,
    })
    return NextResponse.json({ folder }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
