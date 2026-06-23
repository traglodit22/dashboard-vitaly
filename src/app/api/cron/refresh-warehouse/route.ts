import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { refreshAllActiveShipmentStatuses } from '@/lib/delivery/refreshShipmentStatuses'
import { sendMessage } from '@/lib/telegram/bot'
import { fetchProviderBalance, forEachProviderSequentially, isSoftBalanceError, priorBalanceOf } from '@/lib/balances/fetchBalance'

export const runtime = 'nodejs'

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

  await query(
    'UPDATE system_settings SET auto_check_last_run_at = $1 WHERE id = 1',
    [new Date().toISOString()],
  )

  const chatIds: string[] = Array.isArray(s.telegram_notify_chat_ids)
    ? (s.telegram_notify_chat_ids as string[])
    : []
  const notifyEnabled = Boolean(s.telegram_notify_enabled)

  let checked = 0
  let changed: Awaited<ReturnType<typeof refreshAllActiveShipmentStatuses>>['changed'] = []

  try {
    const result = await refreshAllActiveShipmentStatuses()
    checked = result.checked
    changed = result.changed
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }

  if (notifyEnabled && chatIds.length > 0 && changed.length > 0) {
    const dateStr = new Date().toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const lines = [
      `🔔 Статусы посылок обновились (${dateStr} МСК)`,
      '',
      `Проверено: ${checked}, изменилось: ${changed.length}`,
      '',
      ...changed.map(
        (c) => `📦 ${c.itemDescription}\n  ${c.fromStatusName} → ${c.toStatusName}`,
      ),
    ]
    try {
      await Promise.all(chatIds.map((id) => sendMessage(id, lines.join('\n'))))
    } catch (e) {
      console.error('Cron shipment telegram notify failed:', e)
    }
  }

  await checkBalances(chatIds, notifyEnabled)

  return NextResponse.json({ checked, changed })
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
        '',
        ...low.map((p) => `📉 ${p.name}: ${p.balance} ${p.currency} (порог: ${p.threshold})`),
      ]
      try {
        await Promise.all(chatIds.map((id) => sendMessage(id, lines.join('\n'))))
      } catch (e) {
        console.error('Cron balance telegram notify failed:', e)
      }
    }
  } catch { /* ignore balance check errors */ }
}
