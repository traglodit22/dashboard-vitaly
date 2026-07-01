import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { rowToItem } from '@/lib/procurement/mapRow'
import { ensureProcurementReady } from '@/lib/procurement/ensureHotelSeed'
import {
  deleteItemImageFiles,
  findItemImageFile,
  mimeForExt,
  saveItemImageFile,
} from '@/lib/procurement/itemImage'

export const runtime = 'nodejs'

async function getItem(id: string) {
  const rows = await query<Record<string, unknown>>(
    `SELECT i.*,
       (SELECT name FROM procurement_categories c WHERE c.id = i.category_id) AS category_name
     FROM procurement_items i WHERE i.id = $1`,
    [id],
  )
  return rows[0] ?? null
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  const row = await getItem(id)
  if (!row || !row.image_mime) {
    return new NextResponse(null, { status: 404 })
  }

  const found = await findItemImageFile(id)
  if (!found) {
    return new NextResponse(null, { status: 404 })
  }

  const buffer = await fs.readFile(found.path)
  const mime = (row.image_mime as string) || mimeForExt(found.ext)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  try {
    await ensureProcurementReady()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { id } = await params
  const row = await getItem(id)
  if (!row) {
    return NextResponse.json({ error: 'Позиция не найдена' }, { status: 404 })
  }
  if (row.row_type === 'type') {
    return NextResponse.json({ error: 'Нельзя загрузить фото для строки типа' }, { status: 400 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const mime = file.type || 'application/octet-stream'
    await saveItemImageFile(id, buffer, mime)

    const rows = await query<Record<string, unknown>>(
      `UPDATE procurement_items
       SET image_mime = $1, image_updated_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *,
         (SELECT name FROM procurement_categories c WHERE c.id = procurement_items.category_id) AS category_name`,
      [mime, id],
    )

    return NextResponse.json({ item: rowToItem(rows[0]) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось сохранить изображение'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  await deleteItemImageFiles(id)
  const rows = await query<Record<string, unknown>>(
    `UPDATE procurement_items
     SET image_mime = NULL, image_updated_at = NULL, updated_at = NOW()
     WHERE id = $1
     RETURNING *,
       (SELECT name FROM procurement_categories c WHERE c.id = procurement_items.category_id) AS category_name`,
    [id],
  )
  if (!rows.length) {
    return NextResponse.json({ error: 'Позиция не найдена' }, { status: 404 })
  }
  return NextResponse.json({ item: rowToItem(rows[0]) })
}
