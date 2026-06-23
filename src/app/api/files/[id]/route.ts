import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { deleteFileItem, fetchFileRow } from '@/lib/files/fileService'
import { setItemInGallery } from '@/lib/files/galleryService'
import { FILE_ITEM_FROM, FILE_ITEM_SELECT, rowToFileItem } from '@/lib/files/mapRow'

export const runtime = 'nodejs'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  const body = await req.json()

  if (body.inGallery !== undefined) {
    try {
      const item = await setItemInGallery(id, Boolean(body.inGallery))
      return NextResponse.json({ item })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  if (typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'Укажите название' }, { status: 400 })
  }

  const rows = await query<Record<string, unknown>>(
    `UPDATE file_items SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
    [body.title.trim(), id],
  )
  if (!rows.length) {
    return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })
  }

  const item = await fetchFileRow(id)
  return NextResponse.json({ item: item ? rowToFileItem(item) : null })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  const row = await fetchFileRow(id)
  if (!row) {
    return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })
  }

  await deleteFileItem(row)
  return NextResponse.json({ ok: true })
}
