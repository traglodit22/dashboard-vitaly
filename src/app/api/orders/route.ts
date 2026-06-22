import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { computeTotalAmount } from '@/lib/delivery/buildPayload'
import { validateOrderDraft, type OrderDraft } from '@/lib/delivery/validation'
import { trySendOrder } from '@/lib/delivery/sendOrder'
import { requireAuth } from '@/lib/auth/requireAuth'
import { DELIVERING_STATUS_ID } from '@/lib/delivery/statuses'
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

// Заказы со статусом «Доставляется» (649) хранятся как архив — по умолчанию
// не отдаём их (вкладка-архив подгружает их отдельно кнопкой, ?archived=1),
// чтобы основной список не тормозил, когда доставленных посылок накопится много.
export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const wantArchived = new URL(req.url).searchParams.get('archived') === '1'

  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM orders ORDER BY created_at DESC',
  )
  const all = rows.map(rowToOrder)
  const orders = wantArchived
    ? all.filter((o) => o.dpStatusId === DELIVERING_STATUS_ID)
    : all.filter((o) => o.dpStatusId !== DELIVERING_STATUS_ID)
  return NextResponse.json({ orders })
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const body = await req.json()
  const draft: OrderDraft = {
    itemDescription: String(body.itemDescription ?? ''),
    numberOfItemPieces: Number(body.numberOfItemPieces),
    itemPrice: Number(body.itemPrice),
    itemStoreLink: String(body.itemStoreLink ?? ''),
    store: body.store,
    incomingDeclaration: body.incomingDeclaration ?? '',
  }

  const errors = validateOrderDraft(draft)
  if (errors.length) return NextResponse.json({ errors }, { status: 400 })

  const track = draft.incomingDeclaration?.trim() || null
  const now = new Date().toISOString()

  const rows = await query<Record<string, unknown>>(
    `INSERT INTO orders (
      item_description, number_of_item_pieces, item_price, item_store_link,
      store, incoming_declaration, total_amount, status,
      recipient_id, dp_shipment_id, dp_track_number, dp_status_id,
      dp_status_name, last_error, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8,
      NULL, NULL, NULL, NULL,
      NULL, NULL, $9, $10
    ) RETURNING *`,
    [
      draft.itemDescription.trim(),
      draft.numberOfItemPieces,
      draft.itemPrice,
      draft.itemStoreLink.trim(),
      draft.store,
      track,
      computeTotalAmount(draft.numberOfItemPieces, draft.itemPrice),
      track ? 'ready' : 'awaiting_track',
      now,
      now,
    ],
  )

  const order = rowToOrder(rows[0])
  // Если трек уже есть — сразу пробуем отправить в ДоброПост.
  if (track) await trySendOrder(order.id)

  // Перечитываем после возможного обновления trySendOrder
  const updated = await query<Record<string, unknown>>(
    'SELECT * FROM orders WHERE id = $1',
    [order.id],
  )
  return NextResponse.json({ order: rowToOrder(updated[0]) })
}
