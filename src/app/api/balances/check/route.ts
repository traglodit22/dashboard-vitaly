import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { sendMessage } from '@/lib/telegram/bot'
import { fetchProviderBalance, mapWithConcurrency } from '@/lib/balances/fetchBalance'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const rows = await query<Record<string, unknown>>(
    `SELECT id, name, api_url, api_key, threshold, currency,
            extra_params, response_type, response_path, request_method, key_param_name
     FROM balance_providers WHERE active = true ORDER BY name`,
  )

  const results: { name: string; balance: number | null; threshold: number; currency: string; error?: string }[] = []
  const low: { name: string; balance: number; threshold: number; currency: string }[] = []

  await mapWithConcurrency(rows, 4, async (row) => {
    const name = row.name as string
    const threshold = Number(row.threshold)
    const currency = (row.currency as string) ?? 'USD'

    try {
      const balance = await fetchProviderBalance(row)

      await query(
        `UPDATE balance_providers SET last_balance = $1, last_checked_at = NOW(), last_error = NULL WHERE id = $2`,
        [balance, row.id],
      )

      results.push({ name, balance, threshold, currency })
      if (balance < threshold) low.push({ name, balance, threshold, currency })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      await query(
        `UPDATE balance_providers SET last_error = $1, last_checked_at = NOW() WHERE id = $2`,
        [error, row.id],
      )
      results.push({ name, balance: null, threshold, currency, error })
    }
  })

  if (low.length > 0) {
    const settingsRows = await query<Record<string, unknown>>(
      'SELECT telegram_notify_chat_ids, telegram_notify_enabled FROM system_settings WHERE id = 1',
    )
    const s = settingsRows[0] ?? {}
    const chatIds: string[] = Array.isArray(s.telegram_notify_chat_ids)
      ? (s.telegram_notify_chat_ids as string[])
      : []

    if (s.telegram_notify_enabled && chatIds.length > 0) {
      const dateStr = new Date().toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
      const lines = [
        `⚠️ Низкий баланс панелей (${dateStr} МСК)`,
        '',
        ...low.map((p) => `📉 ${p.name}: ${p.balance} ${p.currency} (порог: ${p.threshold})`),
      ]
      await Promise.all(chatIds.map((id) => sendMessage(id, lines.join('\n'))))
    }
  }

  results.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  return NextResponse.json({ checked: rows.length, results, low })
}
