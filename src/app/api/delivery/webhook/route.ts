import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'

export const runtime = 'nodejs'

// Webhook от ДоброПост: обновление статуса отправки.
// Защита — секрет в query (?secret=...), который задаём при регистрации webhook у ДоброПост.
export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret')
  const expected = process.env.DOBROPOST_WEBHOOK_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 401 })
  }

  let body: {
    shipmentId?: number
    DPTrackNumber?: string
    statusDate?: string
    status?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  if (body.shipmentId != null) {
    const rows = await query<Record<string, unknown>>(
      'SELECT * FROM orders WHERE dp_shipment_id = $1 LIMIT 1',
      [body.shipmentId],
    )
    if (rows.length > 0) {
      const existing = rows[0]
      await query(
        `UPDATE orders SET
          dp_status_name = $1,
          dp_status_date = $2,
          dp_track_number = COALESCE($3, dp_track_number),
          updated_at = $4
        WHERE id = $5`,
        [
          body.status ?? null,
          body.statusDate ?? null,
          body.DPTrackNumber ?? null,
          new Date().toISOString(),
          existing.id,
        ],
      )
    }
  }

  // ДоброПост ждёт 200 с пустым телом.
  return new NextResponse(null, { status: 200 })
}
