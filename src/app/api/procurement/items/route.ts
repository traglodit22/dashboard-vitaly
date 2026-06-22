import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { rowToItem } from '@/lib/procurement/mapRow'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get('categoryId')

  const rows = await query<Record<string, unknown>>(
    `SELECT i.*, c.name AS category_name
     FROM procurement_items i
     JOIN procurement_categories c ON c.id = i.category_id
     ${categoryId ? 'WHERE i.category_id = $1' : ''}
     ORDER BY i.sort_order ASC, i.name ASC`,
    categoryId ? [categoryId] : [],
  )

  return NextResponse.json({ items: rows.map(rowToItem) })
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const body = await req.json()
  const categoryId = String(body.categoryId ?? '').trim()
  const name = String(body.name ?? '').trim()
  const rowType = body.rowType === 'type' ? 'type' : 'item'
  if (!categoryId || !name) {
    return NextResponse.json({ error: 'Укажите категорию и название' }, { status: 400 })
  }

  const rows = await query<Record<string, unknown>>(
    `INSERT INTO procurement_items
      (category_id, group_name, name, need_qty, have_qty, in_transit_qty, notes, link, row_type, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
       COALESCE((SELECT MAX(sort_order) + 10 FROM procurement_items WHERE category_id = $1), 0))
     RETURNING *, (SELECT name FROM procurement_categories WHERE id = $1) AS category_name`,
    [
      categoryId,
      rowType === 'type' ? null : body.groupName ? String(body.groupName).trim() : null,
      name,
      rowType === 'type' ? 0 : Math.max(0, Number(body.needQty ?? 0)),
      rowType === 'type' ? 0 : Math.max(0, Number(body.haveQty ?? 0)),
      rowType === 'type' ? 0 : Math.max(0, Number(body.inTransitQty ?? 0)),
      rowType === 'type' ? null : body.notes ? String(body.notes).trim() : null,
      rowType === 'type' ? null : body.link ? String(body.link).trim() : null,
      rowType,
    ],
  )

  return NextResponse.json({ item: rowToItem(rows[0]) }, { status: 201 })
}
