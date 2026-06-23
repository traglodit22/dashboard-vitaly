import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { rowToStatus } from '@/lib/procurement/mapRow'
import { ensureHotelProcurement } from '@/lib/procurement/ensureHotelSeed'
import { STATUS_COLOR_KEYS, type StatusColorKey } from '@/lib/procurement/statusColors'

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
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { id } = await params
  const body = await req.json()

  const setClauses: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) {
      return NextResponse.json({ error: 'Название не может быть пустым' }, { status: 400 })
    }
    setClauses.push(`name = $${idx++}`)
    values.push(name)
  }
  if (body.colorKey !== undefined) {
    const colorKey = body.colorKey as StatusColorKey
    if (!STATUS_COLOR_KEYS.includes(colorKey)) {
      return NextResponse.json({ error: 'Недопустимый цвет' }, { status: 400 })
    }
    setClauses.push(`color_key = $${idx++}`)
    values.push(colorKey)
  }

  if (!setClauses.length) {
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
  }

  values.push(id)
  const rows = await query<Record<string, unknown>>(
    `UPDATE procurement_statuses SET ${setClauses.join(', ')}
     WHERE id = $${idx}
     RETURNING *`,
    values,
  )

  if (!rows.length) {
    return NextResponse.json({ error: 'Статус не найден' }, { status: 404 })
  }

  return NextResponse.json({ status: rowToStatus(rows[0]) })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params

  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM procurement_items WHERE status_id = $1`,
    [id],
  )
  if (Number(count) > 0) {
    return NextResponse.json(
      { error: `Статус используется в ${count} позициях. Сначала снимите его с позиций.` },
      { status: 409 },
    )
  }

  const rows = await query<{ id: string }>(
    `DELETE FROM procurement_statuses WHERE id = $1 RETURNING id`,
    [id],
  )
  if (!rows.length) {
    return NextResponse.json({ error: 'Статус не найден' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
