import { NextResponse } from 'next/server'
import { runMigrations } from '@/lib/db/runMigrations'
import { query } from '@/lib/db/index'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse(null, { status: 401 })
  }

  try {
    const applied = await runMigrations()
    const [{ count }] = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM procurement_items i
       JOIN procurement_categories c ON c.id = i.category_id
       WHERE c.name = 'Отель'`,
    )
    return NextResponse.json({ ok: true, applied, hotelItems: Number(count) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
