import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { trySendOrder } from '@/lib/delivery/sendOrder'
import { requireAuth } from '@/lib/auth/requireAuth'
import type { ProductOrder, StoreType, OrderStatus } from '@/types'

export const runtime = 'nodejs'

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

// Повторная отправка заказа в ДоброПост (для статуса 'ready').
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const { id } = await params
  const result = await trySendOrder(id)

  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM orders WHERE id = $1',
    [id],
  )
  if (rows.length === 0) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
  return NextResponse.json({ order: rowToOrder(rows[0]), sent: result.ok, error: result.error })
}
