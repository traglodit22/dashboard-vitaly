import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { sendMessage } from '@/lib/telegram/bot'

export const runtime = 'nodejs'

// Extract nested value by dot-notation path: "response.success.data.balance.amount"
function getNestedValue(obj: unknown, path: string): number | null {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return null
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur != null ? Number(cur) : null
}

async function fetchBalance(row: Record<string, unknown>): Promise<number> {
  const apiUrl = row.api_url as string
  const apiKey = row.api_key as string
  const method = ((row.request_method as string) || 'POST').toUpperCase()
  const keyParam = (row.key_param_name as string) || 'key'
  const extraParams = (row.extra_params as string) || ''
  const responseType = (row.response_type as string) || 'json'
  const responsePath = (row.response_path as string) || 'balance'
  // json_body: send POST as JSON object instead of form-encoded
  const useJsonBody = extraParams.startsWith('json:')
  const actualExtra = useJsonBody ? extraParams.slice(5) : extraParams

  let res: Response

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

  if (method === 'GET') {
    const keyPart = `${encodeURIComponent(keyParam)}=${encodeURIComponent(apiKey)}`
    const qs = [keyPart, actualExtra].filter(Boolean).join('&')
    res = await fetch(`${apiUrl}${apiUrl.includes('?') ? '&' : '?'}${qs}`, {
      method: 'GET',
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
    })
  } else if (useJsonBody) {
    const bodyObj: Record<string, string> = { [keyParam]: apiKey }
    if (actualExtra) {
      for (const part of actualExtra.split('&')) {
        const [k, v] = part.split('=')
        if (k) bodyObj[decodeURIComponent(k)] = decodeURIComponent(v ?? '')
      }
    }
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify(bodyObj),
      signal: AbortSignal.timeout(10000),
    })
  } else {
    const keyPart = `${encodeURIComponent(keyParam)}=${encodeURIComponent(apiKey)}`
    const body = [keyPart, actualExtra].filter(Boolean).join('&')
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body,
      signal: AbortSignal.timeout(10000),
    })
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)

  if (responseType === 'text') {
    const text = (await res.text()).trim()
    const num = parseFloat(text)
    if (isNaN(num)) throw new Error(`Ответ не является числом: "${text.substring(0, 50)}"`)
    return num
  }

  const data = await res.json() as Record<string, unknown>
  if (data.error) throw new Error(String(data.error))

  const balance = getNestedValue(data, responsePath)
  if (balance === null) throw new Error(`Путь "${responsePath}" не найден в ответе`)
  return balance
}

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

  await Promise.all(rows.map(async (row) => {
    const name = row.name as string
    const threshold = Number(row.threshold)
    const currency = (row.currency as string) ?? 'USD'

    try {
      const balance = await fetchBalance(row)

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
  }))

  // Telegram notification if any balances are low
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

  return NextResponse.json({ checked: rows.length, results, low })
}
