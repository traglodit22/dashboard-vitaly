import { query } from '@/lib/db/index'
import { getNextRecipient } from './rotation'
import { buildShipmentPayload } from './buildPayload'
import { createShipment } from './client'
import type { ProductOrder } from '@/types'

function rowToOrder(row: Record<string, unknown>): ProductOrder {
  return {
    id: row.id as string,
    itemDescription: row.item_description as string,
    numberOfItemPieces: row.number_of_item_pieces as number,
    itemPrice: Number(row.item_price),
    itemStoreLink: row.item_store_link as string,
    store: row.store as ProductOrder['store'],
    incomingDeclaration: (row.incoming_declaration as string | null) ?? null,
    totalAmount: Number(row.total_amount),
    status: row.status as ProductOrder['status'],
    recipientId: (row.recipient_id as string | null) ?? null,
    dpShipmentId: (row.dp_shipment_id as number | null) ?? null,
    dpTrackNumber: (row.dp_track_number as string | null) ?? null,
    dpStatusId: (row.dp_status_id as number | null) ?? null,
    dpStatusName: (row.dp_status_name as string | null) ?? null,
    dpWeightKg: row.dp_weight_kg != null ? Number(row.dp_weight_kg) : null,
    lastError: (row.last_error as string | null) ?? null,
    createdAt: row.created_at instanceof Date
      ? (row.created_at as Date).toISOString()
      : (row.created_at as string),
    updatedAt: row.updated_at instanceof Date
      ? (row.updated_at as Date).toISOString()
      : (row.updated_at as string),
  }
}

/**
 * Пытается отправить заказ в ДоброПост: берёт следующего получателя по кругу,
 * собирает payload и создаёт Shipment. При успехе — статус 'sent' и трек ДоброПост.
 * При ошибке (нет кредов / нет получателей / отказ API) — статус остаётся 'ready',
 * а текст ошибки кладётся в last_error (можно повторить кнопкой «Отправить»).
 */
export async function trySendOrder(orderId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const rows = await query<Record<string, unknown>>(
      'SELECT * FROM orders WHERE id = $1',
      [orderId],
    )
    if (rows.length === 0) throw new Error('Заказ не найден')
    const order = rowToOrder(rows[0])
    if (!order.incomingDeclaration) throw new Error('Нет трек-кода — отправка невозможна')

    const recipient = await getNextRecipient()
    const res = await createShipment(
      buildShipmentPayload(
        {
          itemDescription: order.itemDescription,
          numberOfItemPieces: order.numberOfItemPieces,
          itemPrice: order.itemPrice,
          itemStoreLink: order.itemStoreLink,
          incomingDeclaration: order.incomingDeclaration,
        },
        recipient,
      ),
    )

    await query(
      `UPDATE orders
       SET status = 'sent',
           recipient_id = $1,
           dp_shipment_id = $2,
           dp_track_number = $3,
           dp_status_id = $4,
           dp_status_name = $5,
           last_error = NULL,
           updated_at = $6
       WHERE id = $7`,
      [
        recipient.id,
        res.id,
        res.DPTrackNumber,
        res.status?.id ?? null,
        res.status?.name ?? null,
        new Date().toISOString(),
        orderId,
      ],
    )

    return { ok: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await query(
      `UPDATE orders
       SET status = 'ready',
           last_error = $1,
           updated_at = $2
       WHERE id = $3`,
      [error, new Date().toISOString(), orderId],
    )
    return { ok: false, error }
  }
}
