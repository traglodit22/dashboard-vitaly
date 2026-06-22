import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { LIMITS } from '@/lib/delivery/constants'
import { trySendOrder } from '@/lib/delivery/sendOrder'
import { computeTotalAmount } from '@/lib/delivery/buildPayload'
import { validateOrderDraft, type OrderDraft } from '@/lib/delivery/validation'
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

// Редактирование заказа, который ещё НЕ отправлен в ДоброПост.
// Меняем поля товара (и трек); статус пересчитывается по наличию трека.
// Отправку в ДоброПост тут не запускаем — это делает кнопка «Отправить» / ввод трека.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const { id } = await params

  const existing = await query<Record<string, unknown>>(
    'SELECT * FROM orders WHERE id = $1',
    [id],
  )
  if (existing.length === 0) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })

  const order = rowToOrder(existing[0])
  if (order.status === 'sent') {
    return NextResponse.json(
      { errors: ['Уже отправлено в ДоброПост — редактирование недоступно'] },
      { status: 400 },
    )
  }

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
  const rows = await query<Record<string, unknown>>(
    `UPDATE orders SET
      item_description = $1,
      number_of_item_pieces = $2,
      item_price = $3,
      item_store_link = $4,
      store = $5,
      incoming_declaration = $6,
      total_amount = $7,
      status = $8,
      last_error = NULL,
      updated_at = $9
    WHERE id = $10 RETURNING *`,
    [
      draft.itemDescription.trim(),
      draft.numberOfItemPieces,
      draft.itemPrice,
      draft.itemStoreLink.trim(),
      draft.store,
      track,
      computeTotalAmount(draft.numberOfItemPieces, draft.itemPrice),
      track ? 'ready' : 'awaiting_track',
      new Date().toISOString(),
      id,
    ],
  )

  return NextResponse.json({ order: rowToOrder(rows[0]) })
}

// Добавление/изменение трек-кода по Китаю. После добавления — пробуем отправить.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const { id } = await params
  const body = await req.json()
  const track = String(body.incomingDeclaration ?? '').trim()

  if (!track || track.length >= LIMITS.incomingDeclarationMax) {
    return NextResponse.json(
      { errors: [`Трек по Китаю обязателен и должен быть короче ${LIMITS.incomingDeclarationMax} символов`] },
      { status: 400 },
    )
  }

  const existing = await query<Record<string, unknown>>(
    'SELECT * FROM orders WHERE id = $1',
    [id],
  )
  if (existing.length === 0) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })

  await query(
    `UPDATE orders SET incoming_declaration = $1, status = 'ready', updated_at = $2 WHERE id = $3`,
    [track, new Date().toISOString(), id],
  )
  const result = await trySendOrder(id)

  const saved = await query<Record<string, unknown>>(
    'SELECT * FROM orders WHERE id = $1',
    [id],
  )
  return NextResponse.json({ order: rowToOrder(saved[0]), sent: result.ok, error: result.error })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const { id } = await params
  await query('DELETE FROM orders WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
