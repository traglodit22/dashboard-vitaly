import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const rows = await query<Record<string, unknown>>(`
    SELECT
      COUNT(*)::int                                                         AS total,
      COUNT(*) FILTER (WHERE status = 'sent')::int                         AS sent_total,
      COUNT(*) FILTER (WHERE status = 'awaiting_track')::int               AS awaiting_track,
      COUNT(*) FILTER (WHERE dp_status_id = 1)::int                        AS on_warehouse,
      COUNT(*) FILTER (
        WHERE status = 'sent'
          AND dp_status_id IS NOT NULL
          AND dp_status_id != 1
          AND dp_status_id != 649
      )::int                                                                AS in_transit,
      COUNT(*) FILTER (WHERE dp_status_id = 649)::int                      AS delivered,
      COALESCE(SUM(dp_weight_kg), 0)                                        AS total_weight_kg,
      COALESCE(SUM(total_amount), 0)                                        AS total_value_cny
    FROM orders
  `)

  const r = rows[0]

  return NextResponse.json({
    orders: {
      total: Number(r.total),
      sentTotal: Number(r.sent_total),
      awaitingTrack: Number(r.awaiting_track),
      onWarehouse: Number(r.on_warehouse),
      inTransit: Number(r.in_transit),
      delivered: Number(r.delivered),
      totalWeightKg: Number(r.total_weight_kg),
      totalValueCny: Number(r.total_value_cny),
    },
  })
}
