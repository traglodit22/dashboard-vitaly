import { NextResponse } from 'next/server'
import { pool, query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { ensureFilesSeed, getCategoryBySlug } from '@/lib/files/ensureFilesSeed'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  await ensureFilesSeed()

  const body = await req.json()
  const categorySlug = String(body.categorySlug ?? '').trim()
  const folderId = body.folderId ? String(body.folderId) : null
  const ids = body.ids
  const scope = body.scope === 'gallery' ? 'gallery' : 'files'

  if (!categorySlug) {
    return NextResponse.json({ error: 'Укажите categorySlug' }, { status: 400 })
  }
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string')) {
    return NextResponse.json({ error: 'Укажите ids: string[]' }, { status: 400 })
  }

  const categoryRow = await getCategoryBySlug(categorySlug)
  if (!categoryRow) {
    return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })
  }

  const categoryId = categoryRow.id as string
  const galleryFilter = scope === 'gallery'

  const rows = await query<{ id: string }>(
    `SELECT id FROM file_items
     WHERE category_id = $1
       AND folder_id IS NOT DISTINCT FROM $2
       AND in_gallery = $3
       AND id = ANY($4::uuid[])`,
    [categoryId, folderId, galleryFilter, ids],
  )
  if (rows.length !== ids.length) {
    return NextResponse.json({ error: 'Некорректный список файлов' }, { status: 400 })
  }

  const orderColumn = scope === 'gallery' ? 'gallery_sort_order' : 'sort_order'
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `UPDATE file_items SET ${orderColumn} = $1, updated_at = NOW()
         WHERE id = $2 AND category_id = $3`,
        [(i + 1) * 10, ids[i], categoryId],
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return NextResponse.json({ ok: true })
}
