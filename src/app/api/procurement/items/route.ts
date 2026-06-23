import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { ITEM_FROM_SQL, ITEM_SELECT_SQL, rowToItem } from '@/lib/procurement/mapRow'
import { ensureHotelProcurement } from '@/lib/procurement/ensureHotelSeed'
import { STORES } from '@/types'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  try {
    await ensureHotelProcurement()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[procurement/items] ensure schema:', message)
    return NextResponse.json({ error: message, items: [] }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get('categoryId')

  const rows = await query<Record<string, unknown>>(
    `SELECT ${ITEM_SELECT_SQL}
     ${ITEM_FROM_SQL}
     ${categoryId ? 'WHERE i.category_id = $1' : ''}
     ORDER BY i.sort_order ASC, i.name ASC`,
    categoryId ? [categoryId] : [],
  )

  return NextResponse.json({ items: rows.map(rowToItem) })
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  try {
    await ensureHotelProcurement()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[procurement/items] ensure schema:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const body = await req.json()
  const categoryId = String(body.categoryId ?? '').trim()
  const name = String(body.name ?? '').trim()
  const rowType = body.rowType === 'type' ? 'type' : 'item'
  if (!categoryId || !name) {
    return NextResponse.json({ error: 'Укажите категорию и название' }, { status: 400 })
  }

  const store =
    rowType === 'type' || !body.store
      ? null
      : (STORES as readonly string[]).includes(String(body.store))
        ? String(body.store)
        : null

  const rows = await query<Record<string, unknown>>(
    `INSERT INTO procurement_items
      (category_id, group_name, name, need_qty, have_qty, in_transit_qty, notes, link, store, row_type, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       COALESCE((SELECT MAX(sort_order) + 10 FROM procurement_items WHERE category_id = $1), 0))
     RETURNING id`,
    [
      categoryId,
      rowType === 'type' ? null : body.groupName ? String(body.groupName).trim() : null,
      name,
      rowType === 'type' ? 0 : Math.max(0, Number(body.needQty ?? 0)),
      rowType === 'type' ? 0 : Math.max(0, Number(body.haveQty ?? 0)),
      rowType === 'type' ? 0 : Math.max(0, Number(body.inTransitQty ?? 0)),
      rowType === 'type' ? null : body.notes ? String(body.notes).trim() : null,
      rowType === 'type' ? null : body.link ? String(body.link).trim() : null,
      store,
      rowType,
    ],
  )

  const inserted = rows[0]
  const full = await query<Record<string, unknown>>(
    `SELECT ${ITEM_SELECT_SQL} ${ITEM_FROM_SQL} WHERE i.id = $1`,
    [inserted.id],
  )

  return NextResponse.json({ item: rowToItem(full[0]) }, { status: 201 })
}
