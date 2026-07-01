import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { rowToStatus } from '@/lib/procurement/mapRow'
import { ensureProcurementReady } from '@/lib/procurement/ensureHotelSeed'
import { STATUS_COLOR_KEYS, type StatusColorKey } from '@/lib/procurement/statusColors'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  try {
    await ensureProcurementReady()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[procurement/statuses] ensure schema:', message)
    return NextResponse.json({ error: message, statuses: [] }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get('categoryId')

  const rows = categoryId
    ? await query<Record<string, unknown>>(
        `SELECT * FROM procurement_statuses
         WHERE category_id = $1
         ORDER BY sort_order ASC, name ASC`,
        [categoryId],
      )
    : await query<Record<string, unknown>>(
        `SELECT s.*
         FROM procurement_statuses s
         JOIN procurement_categories c ON c.id = s.category_id
         ORDER BY c.sort_order ASC, s.sort_order ASC, s.name ASC`,
      )

  return NextResponse.json({ statuses: rows.map(rowToStatus) })
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  try {
    await ensureProcurementReady()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const body = await req.json()
  const categoryId = String(body.categoryId ?? '').trim()
  const name = String(body.name ?? '').trim()
  const colorKey = body.colorKey as StatusColorKey

  if (!categoryId || !name) {
    return NextResponse.json({ error: 'Укажите категорию и название' }, { status: 400 })
  }
  if (!STATUS_COLOR_KEYS.includes(colorKey)) {
    return NextResponse.json({ error: 'Недопустимый цвет' }, { status: 400 })
  }

  const rows = await query<Record<string, unknown>>(
    `INSERT INTO procurement_statuses (category_id, name, color_key, sort_order)
     VALUES (
       $1, $2, $3,
       COALESCE((SELECT MAX(sort_order) + 10 FROM procurement_statuses WHERE category_id = $1), 10)
     )
     RETURNING *`,
    [categoryId, name, colorKey],
  )

  return NextResponse.json({ status: rowToStatus(rows[0]) }, { status: 201 })
}
