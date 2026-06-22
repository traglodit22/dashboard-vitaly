import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getShipmentStatuses } from '@/lib/delivery/client'
import { getStatusName } from '@/lib/delivery/statuses'
import type { ProductOrder, StoreType, OrderStatus } from '@/types'

export const runtime = 'nodejs'

// "Ожидается на складе" — стартовый статус отправки в ДоброПост.
const WAREHOUSE_STATUS_ID = 1

function rowToOrder(row: Record<string, unknown>): ProductOrder {
  return {
    id: row.id as string,
    itemDescription: row.item_description as string,
    numberOfItemPieces: Number(row.number_of_item_pieces),
    itemPrice: Number(row.item_price),
    itemStoreLink: (row.item_store_link as string) ?? '',
    store: row.store as StoreType,
    incomingDeclaration: (row.incoming_declaration as string) ?? null,
    totalAmount: Number(row.total_amount),
    status: row.status as OrderStatus,
    recipientId: (row.recipient_id as string) ?? null,
    dpShipmentId: row.dp_shipment_id != null ? Number(row.dp_shipment_id) : null,
    dpTrackNumber: (row.dp_track_number as string) ?? null,
    dpStatusId: row.dp_status_id != null ? Number(row.dp_status_id) : null,
    dpStatusName: (row.dp_status_name as string) ?? null,
    dpWeightKg: row.dp_weight_kg != null ? Number(row.dp_weight_kg) : null,
    lastError: (row.last_error as string) ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }
}

// Опрашивает ДоброПост по всем заказам, которые сейчас «Ожидается на складе»,
// и обновляет сменившие статус. Возвращает список изменений для подсветки в UI.
export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM orders WHERE dp_status_id = $1',
    [WAREHOUSE_STATUS_ID],
  )

  const targets = rows.map(rowToOrder).filter((o) => o.dpShipmentId != null)

  if (targets.length === 0) {
    return NextResponse.json({ checked: 0, changed: [] })
  }

  let statuses: Map<number, { id: number; name: string; weightKg: number | null }>
  try {
    statuses = await getShipmentStatuses(
      targets.map((o) => o.dpShipmentId as number),
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }

  const now = new Date().toISOString()
  const changed: {
    id: string
    itemDescription: string
    fromStatusName: string
    toStatusId: number
    toStatusName: string
  }[] = []

  await Promise.all(
    targets.map(async (o) => {
      const cur = statuses.get(o.dpShipmentId as number)
      if (!cur || cur.id === o.dpStatusId) return

      // Вес склад проставляет в момент получения посылки — фиксируем его именно
      // в момент смены статуса (если ДоброПост уже его отдал).
      await query(
        `UPDATE orders SET
          dp_status_id = $1,
          dp_status_name = $2,
          dp_weight_kg = COALESCE($3, dp_weight_kg),
          updated_at = $4
        WHERE id = $5`,
        [cur.id, cur.name, cur.weightKg ?? null, now, o.id],
      )

      changed.push({
        id: o.id,
        itemDescription: o.itemDescription,
        fromStatusName: getStatusName(WAREHOUSE_STATUS_ID),
        toStatusId: cur.id,
        toStatusName: cur.name,
      })
    }),
  )

  return NextResponse.json({ checked: targets.length, changed })
}
