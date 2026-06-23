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
  const parentId = body.parentId ? String(body.parentId) : null
  const ids = body.ids

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

  const rows = await query<{ id: string }>(
    `SELECT id FROM file_folders
     WHERE category_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND id = ANY($3::uuid[])`,
    [categoryId, parentId, ids],
  )
  if (rows.length !== ids.length) {
    return NextResponse.json({ error: 'Некорректный список папок' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `UPDATE file_folders SET sort_order = $1
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
