import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { rowToItem } from '@/lib/procurement/mapRow'
import { ensureHotelProcurement } from '@/lib/procurement/ensureHotelSeed'

export const runtime = 'nodejs'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  try {
    await ensureHotelProcurement()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[procurement/items/id] ensure schema:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { id } = await params
  const body = await req.json()

  const setClauses: string[] = ['updated_at = NOW()']
  const values: unknown[] = []
  let idx = 1

  if (typeof body.name === 'string') {
    setClauses.push(`name = $${idx++}`)
    values.push(body.name.trim())
  }
  if (body.groupName !== undefined) {
    setClauses.push(`group_name = $${idx++}`)
    values.push(body.groupName ? String(body.groupName).trim() : null)
  }
  if (typeof body.needQty === 'number') {
    setClauses.push(`need_qty = $${idx++}`)
    values.push(Math.max(0, body.needQty))
  }
  if (typeof body.haveQty === 'number') {
    setClauses.push(`have_qty = $${idx++}`)
    values.push(Math.max(0, body.haveQty))
  }
  if (typeof body.inTransitQty === 'number') {
    setClauses.push(`in_transit_qty = $${idx++}`)
    values.push(Math.max(0, body.inTransitQty))
  }
  if (body.notes !== undefined) {
    setClauses.push(`notes = $${idx++}`)
    values.push(body.notes ? String(body.notes).trim() : null)
  }
  if (body.link !== undefined) {
    setClauses.push(`link = $${idx++}`)
    values.push(body.link ? String(body.link).trim() : null)
  }
  if (body.linkLabel !== undefined) {
    setClauses.push(`link_label = $${idx++}`)
    values.push(body.linkLabel ? String(body.linkLabel).trim() : null)
  }
  if (body.highlightColor !== undefined) {
    const c = body.highlightColor
    if (c !== null && c !== 'red' && c !== 'yellow' && c !== 'green') {
      return NextResponse.json({ error: 'Недопустимый цвет' }, { status: 400 })
    }
    setClauses.push(`highlight_color = $${idx++}`)
    values.push(c)
  }

  if (setClauses.length === 1) {
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
  }

  values.push(id)
  const rows = await query<Record<string, unknown>>(
    `UPDATE procurement_items SET ${setClauses.join(', ')}
     WHERE id = $${idx}
     RETURNING *,
       (SELECT name FROM procurement_categories c WHERE c.id = procurement_items.category_id) AS category_name`,
    values,
  )

  if (!rows.length) {
    return NextResponse.json({ error: 'Позиция не найдена' }, { status: 404 })
  }

  return NextResponse.json({ item: rowToItem(rows[0]) })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  await query('DELETE FROM procurement_items WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
