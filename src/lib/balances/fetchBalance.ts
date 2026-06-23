export interface BalanceProviderRow {
  api_url: string
  api_key: string
  request_method?: string | null
  key_param_name?: string | null
  extra_params?: string | null
  response_type?: string | null
  response_path?: string | null
  last_balance?: number | string | null
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const RETRY_DELAYS_MS = [400, 1200, 2500]
const BETWEEN_PROVIDERS_MS = 400

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getNestedValue(obj: unknown, path: string): number | null {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return null
    cur = (cur as Record<string, unknown>)[p]
  }
  if (cur == null || cur === '') return null
  const num = Number(cur)
  return Number.isFinite(num) ? num : null
}

function parseBalanceFromText(
  text: string,
  responseType: string,
  responsePath: string,
): number {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Пустой ответ API')

  if (responseType === 'text') {
    const num = parseFloat(trimmed)
    if (Number.isNaN(num)) {
      throw new Error(`Ответ не является числом: "${trimmed.substring(0, 50)}"`)
    }
    return num
  }

  let data: unknown
  try {
    data = JSON.parse(trimmed)
  } catch {
    const num = parseFloat(trimmed)
    if (!Number.isNaN(num)) return num
    throw new Error(`Некорректный JSON: "${trimmed.substring(0, 80)}"`)
  }

  if (data && typeof data === 'object') {
    const rec = data as Record<string, unknown>
    if ('errorcode' in rec && Number(rec.errorcode) !== 0) {
      throw new Error(String(rec.errormessage ?? `API error ${rec.errorcode}`))
    }
    if ('error' in rec && rec.error) {
      throw new Error(String(rec.error))
    }
  }

  const balance = getNestedValue(data, responsePath)
  if (balance === null) {
    throw new Error(`Путь "${responsePath}" не найден в ответе`)
  }
  return balance
}

async function requestBalance(row: BalanceProviderRow): Promise<number> {
  const apiUrl = row.api_url
  const apiKey = row.api_key
  const method = ((row.request_method as string) || 'POST').toUpperCase()
  const keyParam = (row.key_param_name as string) || 'key'
  const extraParams = (row.extra_params as string) || ''
  const responseType = (row.response_type as string) || 'json'
  const responsePath = (row.response_path as string) || 'balance'
  const useJsonBody = extraParams.startsWith('json:')
  const actualExtra = useJsonBody ? extraParams.slice(5) : extraParams

  let res: Response

  if (method === 'GET') {
    const keyPart = `${encodeURIComponent(keyParam)}=${encodeURIComponent(apiKey)}`
    const qs = [keyPart, actualExtra].filter(Boolean).join('&')
    res = await fetch(`${apiUrl}${apiUrl.includes('?') ? '&' : '?'}${qs}`, {
      method: 'GET',
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15000),
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
      signal: AbortSignal.timeout(15000),
    })
  } else {
    const keyPart = `${encodeURIComponent(keyParam)}=${encodeURIComponent(apiKey)}`
    const body = [keyPart, actualExtra].filter(Boolean).join('&')
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body,
      signal: AbortSignal.timeout(15000),
    })
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)

  const text = await res.text()
  return parseBalanceFromText(text, responseType, responsePath)
}

export function isSoftBalanceError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('Пустой ответ') ||
    msg.includes('Unexpected end of JSON') ||
    msg.includes('Некорректный JSON') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT')
  )
}

function isRetryable(err: unknown): boolean {
  return isSoftBalanceError(err)
}

/** Запрос баланса с повторами при пустом/битом ответе. */
export async function fetchProviderBalance(row: BalanceProviderRow | Record<string, unknown>): Promise<number> {
  const r = row as BalanceProviderRow
  let lastErr: unknown

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await requestBalance(r)
    } catch (e) {
      lastErr = e
      if (!isRetryable(e) || attempt === RETRY_DELAYS_MS.length) break
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }

  throw lastErr
}

/** Панели SMM часто отдают пустой ответ при пачке запросов — идём по одной. */
export async function forEachProviderSequentially<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    await fn(items[i])
    if (i < items.length - 1) await sleep(BETWEEN_PROVIDERS_MS)
  }
}

export function priorBalanceOf(row: Record<string, unknown>): number | null {
  const v = row.last_balance
  if (v == null || v === '') return null
  const num = Number(v)
  return Number.isFinite(num) ? num : null
}
