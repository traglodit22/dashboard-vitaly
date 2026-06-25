export const FUNKO_CHANGED_EVENT = 'funko:changed'
export const FUNKO_CREATE_EVENT = 'funko:create'

export function notifyFunkoChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FUNKO_CHANGED_EVENT))
  }
}

export function requestFunkoCreate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FUNKO_CREATE_EVENT))
  }
}

export type FunkoFilter = 'owned' | 'inTransit' | 'all'

export const DEFAULT_FUNKO_CATEGORY = 'animation'

export function parseFunkoSearchParams(params: URLSearchParams): {
  category: string
  filter: FunkoFilter
  page: number
  q: string
} {
  const rawCategory = params.get('category')?.trim()
  const category = rawCategory || DEFAULT_FUNKO_CATEGORY
  const rawFilter = params.get('filter')
  const filter: FunkoFilter =
    rawFilter === 'inTransit' || rawFilter === 'all' ? rawFilter : 'owned'
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const q = params.get('q') ?? ''
  return { category, filter, page, q }
}

export function buildFunkoHref(opts: {
  category?: string
  filter?: FunkoFilter
  page?: number
  q?: string
}): string {
  const params = new URLSearchParams()
  const category = opts.category ?? DEFAULT_FUNKO_CATEGORY
  if (category !== DEFAULT_FUNKO_CATEGORY) params.set('category', category)
  params.set('filter', opts.filter ?? 'owned')
  if (opts.page && opts.page > 1) params.set('page', String(opts.page))
  if (opts.q?.trim()) params.set('q', opts.q.trim())
  const qs = params.toString()
  return `/funko${qs ? `?${qs}` : ''}`
}
