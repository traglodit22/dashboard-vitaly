import type {
  LasLegasCalendar,
  LasLegasDayDetail,
  LasLegasOverview,
  LasLegasPeriodDetail,
} from './types'

const DEFAULT_URL = 'https://las-legas.by/api/integrations/dashboard/stats'

export class LasLegasNotConfiguredError extends Error {
  constructor() {
    super('Las Legas API не настроен')
    this.name = 'LasLegasNotConfiguredError'
  }
}

export class LasLegasApiError extends Error {
  status: number

  constructor(status: number, message?: string) {
    super(message ?? `Las Legas API ${status}`)
    this.name = 'LasLegasApiError'
    this.status = status
  }
}

export function isLasLegasConfigured(): boolean {
  return Boolean(process.env.LAS_LEGAS_API_KEY?.trim())
}

function baseUrl(): string {
  return (process.env.LAS_LEGAS_API_URL ?? DEFAULT_URL).replace(/\/$/, '')
}

function cacheTtlMs(): number {
  const sec = Number(process.env.LAS_LEGAS_CACHE_TTL_SEC)
  return (Number.isFinite(sec) && sec > 0 ? sec : 300) * 1000
}

const cache = new Map<string, { data: unknown; expiresAt: number }>()

export async function fetchLasLegas<T>(
  params: Record<string, string>,
): Promise<T> {
  const key = process.env.LAS_LEGAS_API_KEY?.trim()
  if (!key) throw new LasLegasNotConfiguredError()

  const qs = new URLSearchParams(params).toString()
  const cacheKey = qs || 'default'
  const hit = cache.get(cacheKey)
  if (hit && hit.expiresAt > Date.now()) {
    return hit.data as T
  }

  const url = qs ? `${baseUrl()}?${qs}` : baseUrl()
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new LasLegasApiError(
      res.status,
      text.slice(0, 200) || undefined,
    )
  }

  const data = (await res.json()) as T
  cache.set(cacheKey, { data, expiresAt: Date.now() + cacheTtlMs() })
  return data
}

export function fetchLasLegasOverview(): Promise<LasLegasOverview> {
  return fetchLasLegas({ view: 'overview' })
}

export function fetchLasLegasCalendar(month: string): Promise<LasLegasCalendar> {
  return fetchLasLegas({ view: 'calendar', month })
}

export function fetchLasLegasDay(date: string): Promise<LasLegasDayDetail> {
  return fetchLasLegas({ date })
}

export function fetchLasLegasPeriod(
  period: 'today' | '7d' | '30d',
): Promise<LasLegasPeriodDetail> {
  return fetchLasLegas({ period })
}

export function fetchLasLegasRange(
  from: string,
  to: string,
): Promise<LasLegasPeriodDetail> {
  return fetchLasLegas({ from, to })
}
