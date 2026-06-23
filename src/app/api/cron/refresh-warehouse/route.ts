import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { getShipmentStatuses } from '@/lib/delivery/client'
import { getStatusName } from '@/lib/delivery/statuses'
import { sendMessage } from '@/lib/telegram/bot'
import { fetchProviderBalance, forEachProviderSequentially, isSoftBalanceError, priorBalanceOf } from '@/lib/balances/fetchBalance'
import type { ProductOrder, StoreType, OrderStatus } from '@/types'

export const runtime = 'nodejs'

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

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse(null, { status: 401 })
  }

  const settingsRows = await query<Record<string, unknown>>(
    'SELECT * FROM system_settings WHERE id = 1',
  )
  const s = settingsRows[0] ?? {}

  if (!s.auto_check_enabled) {
    return NextResponse.json({ skipped: 'disabled' })
  }

  const intervalMs = ((s.auto_check_interval_hours as number) ?? 12) * 3600 * 1000
  const lastRunAt = (s.auto_check_last_run_at as string | null) ?? null
  const lastRunMs = lastRunAt ? new Date(lastRunAt).getTime() : 0
  const now = Date.now()

  if (now - lastRunMs < intervalMs) {
    const nextRunMin = Math.round((lastRunMs + intervalMs - now) / 60000)
    return NextResponse.json({ skipped: 'too_soon', nextRunIn: `${nextRunMin}min` })
  }

  const nowIso = new Date().toISOString()
  // Stamp last run immediately so parallel invocations don't double-fire
  await query(
    'UPDATE system_settings SET auto_check_last_run_at = $1 WHERE id = 1',
    [nowIso],
  )

  const orderRows = await query<Record<string, unknown>>(
    'SELECT * FROM orders WHERE dp_status_id = $1',
    [WAREHOUSE_STATUS_ID],
  )

  const targets = orderRows.map(rowToOrder).filter((o) => o.dpShipmentId != null)

  if (targets.length === 0) {
    return NextResponse.json({ checked: 0, changed: [] })
  }

  let statuses: Map<number, { id: number; name: string; weightKg: number | null }>
  try {
    statuses = await getShipmentStatuses(targets.map((o) => o.dpShipmentId as number))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }

  const changed: { itemDescription: string; toStatusName: string }[] = []

  await Promise.all(
    targets.map(async (o) => {
      const cur = statuses.get(o.dpShipmentId as number)
      if (!cur || cur.id === o.dpStatusId) return

      await query(
        `UPDATE orders SET
          dp_status_id = $1,
          dp_status_name = $2,
          dp_weight_kg = COALESCE($3, dp_weight_kg),
          updated_at = $4
        WHERE id = $5`,
        [cur.id, cur.name, cur.weightKg ?? null, nowIso, o.id],
      )

      changed.push({ itemDescription: o.itemDescription, toStatusName: cur.name })
    }),
  )

  // Telegram notification on changes
  const chatIds: string[] = Array.isArray(s.telegram_notify_chat_ids)
    ? (s.telegram_notify_chat_ids as string[])
    : []

  if (s.telegram_notify_enabled && chatIds.length > 0 && changed.length > 0) {
    const dateStr = new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const fromStatus = getStatusName(WAREHOUSE_STATUS_ID)
    const lines = [
      `🔔 Складские статусы обновились (${dateStr} МСК)`,
      ``,
      `Проверено: ${targets.length}, изменилось: ${changed.length}`,
      ``,
      ...changed.map((c) => `📦 ${c.itemDescription}\n  ${fromStatus} → ${c.toStatusName}`),
    ]
    try {
      await Promise.all(chatIds.map((id) => sendMessage(id, lines.join('\n'))))
    } catch (e) {
      console.error('Cron telegram notify failed:', e)
    }
  }

  // Also check balances and notify if any are low
  await checkBalances(chatIds, Boolean(s.telegram_notify_enabled))

  return NextResponse.json({ checked: targets.length, changed })
}

async function checkBalances(chatIds: string[], notifyEnabled: boolean) {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT id, name, api_url, api_key, threshold, currency, last_balance,
              extra_params, response_type, response_path, request_method, key_param_name
       FROM balance_providers WHERE active = true ORDER BY name`,
    )
    if (rows.length === 0) return

    const low: { name: string; balance: number; threshold: number; currency: string }[] = []

    await forEachProviderSequentially(rows, async (row) => {
      const cached = priorBalanceOf(row)
      try {
        const balance = await fetchProviderBalance(row)

        await query(
          `UPDATE balance_providers SET last_balance = $1, last_checked_at = NOW(), last_error = NULL WHERE id = $2`,
          [balance, row.id],
        )
        if (balance < Number(row.threshold)) {
          low.push({
            name: row.name as string,
            balance,
            threshold: Number(row.threshold),
            currency: (row.currency as string) ?? 'USD',
          })
        }
      } catch (e) {
        if (isSoftBalanceError(e) && cached !== null) {
          await query(
            `UPDATE balance_providers SET last_checked_at = NOW(), last_error = NULL WHERE id = $1`,
            [row.id],
          )
          if (cached < Number(row.threshold)) {
            low.push({
              name: row.name as string,
              balance: cached,
              threshold: Number(row.threshold),
              currency: (row.currency as string) ?? 'USD',
            })
          }
          return
        }
        const errMsg = e instanceof Error ? e.message : String(e)
        await query(
          `UPDATE balance_providers SET last_error = $1, last_checked_at = NOW() WHERE id = $2`,
          [errMsg, row.id],
        )
      }
    })

    if (notifyEnabled && chatIds.length > 0 && low.length > 0) {
      const dateStr = new Date().toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
      const lines = [
        `⚠️ Низкий баланс панелей (${dateStr} МСК)`,
        ``,
        ...low.map((p) => `📉 ${p.name}: ${p.balance} ${p.currency} (порог: ${p.threshold})`),
      ]
      try {
        await Promise.all(chatIds.map((id) => sendMessage(id, lines.join('\n'))))
      } catch (e) {
        console.error('Cron balance telegram notify failed:', e)
      }
    }
  } catch { /* ignore balance check errors so warehouse check always returns */ }
}
