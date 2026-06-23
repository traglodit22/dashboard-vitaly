import { query } from '@/lib/db/index'
import { getShipmentStatuses } from '@/lib/delivery/client'
import { DELIVERING_STATUS_ID, getStatusName } from '@/lib/delivery/statuses'
import type { ProductOrder, StoreType, OrderStatus } from '@/types'

const WAREHOUSE_STATUS_ID = 1

export interface ShipmentStatusChange {
  id: string
  itemDescription: string
  fromStatusName: string
  toStatusId: number
  toStatusName: string
}

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

async function applyStatusUpdates(
  targets: ProductOrder[],
  fromStatus: (order: ProductOrder) => string,
): Promise<{ checked: number; changed: ShipmentStatusChange[] }> {
  if (targets.length === 0) return { checked: 0, changed: [] }

  const statuses = await getShipmentStatuses(targets.map((o) => o.dpShipmentId as number))
  const now = new Date().toISOString()
  const changed: ShipmentStatusChange[] = []

  await Promise.all(
    targets.map(async (o) => {
      const cur = statuses.get(o.dpShipmentId as number)
      if (!cur) return
      const statusChanged = cur.id !== o.dpStatusId
      const weightChanged = cur.weightKg != null && cur.weightKg !== o.dpWeightKg
      if (!statusChanged && !weightChanged) return

      await query(
        `UPDATE orders SET
          dp_status_id = $1,
          dp_status_name = $2,
          dp_weight_kg = COALESCE($3, dp_weight_kg),
          updated_at = $4
        WHERE id = $5`,
        [cur.id, cur.name, cur.weightKg ?? null, now, o.id],
      )

      if (statusChanged) {
        changed.push({
          id: o.id,
          itemDescription: o.itemDescription,
          fromStatusName: fromStatus(o),
          toStatusId: cur.id,
          toStatusName: cur.name,
        })
      }
    }),
  )

  return { checked: targets.length, changed }
}

/** Заказы «Ожидается на складе». */
export async function refreshWarehouseShipmentStatuses(): Promise<{
  checked: number
  changed: ShipmentStatusChange[]
}> {
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM orders WHERE dp_status_id = $1',
    [WAREHOUSE_STATUS_ID],
  )
  const targets = rows.map(rowToOrder).filter((o) => o.dpShipmentId != null)
  return applyStatusUpdates(targets, () => getStatusName(WAREHOUSE_STATUS_ID))
}

/** Заказы в пути: уже не на складе, но ещё не «Доставляется» (архив). */
export async function refreshOtherShipmentStatuses(): Promise<{
  checked: number
  changed: ShipmentStatusChange[]
}> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM orders
     WHERE status = 'sent'
       AND dp_status_id != $1
       AND dp_status_id != $2`,
    [WAREHOUSE_STATUS_ID, DELIVERING_STATUS_ID],
  )
  const targets = rows.map(rowToOrder).filter((o) => o.dpShipmentId != null)
  return applyStatusUpdates(
    targets,
    (o) => o.dpStatusName ?? getStatusName(o.dpStatusId as number),
  )
}

export async function refreshAllActiveShipmentStatuses(): Promise<{
  checked: number
  changed: ShipmentStatusChange[]
}> {
  const warehouse = await refreshWarehouseShipmentStatuses()
  const other = await refreshOtherShipmentStatuses()
  return {
    checked: warehouse.checked + other.checked,
    changed: [...warehouse.changed, ...other.changed],
  }
}
