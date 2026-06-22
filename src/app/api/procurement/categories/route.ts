import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { rowToCategory } from '@/lib/procurement/mapRow'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM procurement_categories ORDER BY sort_order ASC, name ASC',
  )
  return NextResponse.json({ categories: rows.map(rowToCategory) })
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const body = await req.json()
  const name = String(body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'Укажите название категории' }, { status: 400 })
  }

  const rows = await query<Record<string, unknown>>(
    `INSERT INTO procurement_categories (name, sort_order)
     VALUES ($1, COALESCE((SELECT MAX(sort_order) + 1 FROM procurement_categories), 0))
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [name],
  )

  return NextResponse.json({ category: rowToCategory(rows[0]) }, { status: 201 })
}
