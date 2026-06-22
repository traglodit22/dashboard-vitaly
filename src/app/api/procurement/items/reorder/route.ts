import { NextResponse } from 'next/server'
import { pool } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const body = await req.json()
  const ids = body.ids
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string')) {
    return NextResponse.json({ error: 'Укажите ids: string[]' }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        'UPDATE procurement_items SET sort_order = $1, updated_at = NOW() WHERE id = $2',
        [(i + 1) * 10, ids[i]],
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
