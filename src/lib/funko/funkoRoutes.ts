export const FUNKO_CHANGED_EVENT = 'funko:changed'
export const FUNKO_CREATE_EVENT = 'funko:create'
export const FUNKO_CATEGORY_ORDER_CHANGED_EVENT = 'funko:category-order-changed'

import { DEFAULT_FUNKO_SORT, parseFunkoSort, type FunkoSort } from '@/lib/funko/funkoSort'

export { DEFAULT_FUNKO_SORT, type FunkoSort } from '@/lib/funko/funkoSort'

export function notifyFunkoChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FUNKO_CHANGED_EVENT))
  }
}

export function notifyFunkoCategoryOrderChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FUNKO_CATEGORY_ORDER_CHANGED_EVENT))
  }
}

export function requestFunkoCreate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FUNKO_CREATE_EVENT))
  }
}

export type FunkoFilter = 'owned' | 'inTransit' | 'all'

export const DEFAULT_FUNKO_CATEGORY = 'animation'
export const ALL_FUNKO_CATEGORY = 'all'

export { isAllFunkoCategorySlug } from '@/lib/funko/categoryConfig'

export function parseFunkoSearchParams(params: URLSearchParams): {
  category: string
  filter: FunkoFilter
  page: number
  q: string
  sort: FunkoSort
} {
  const rawCategory = params.get('category')?.trim()
  const category = rawCategory || DEFAULT_FUNKO_CATEGORY
  const rawFilter = params.get('filter')
  const filter: FunkoFilter =
    rawFilter === 'inTransit' || rawFilter === 'all' ? rawFilter : 'owned'
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const q = params.get('q') ?? ''
  const sort = parseFunkoSort(params.get('sort'))
  return { category, filter, page, q, sort }
}

export function buildFunkoHref(opts: {
  category?: string
  filter?: FunkoFilter
  page?: number
  q?: string
  sort?: FunkoSort
}): string {
  const params = new URLSearchParams()
  const category = opts.category ?? DEFAULT_FUNKO_CATEGORY
  if (category !== DEFAULT_FUNKO_CATEGORY) params.set('category', category)
  params.set('filter', opts.filter ?? 'owned')
  const sort = opts.sort ?? DEFAULT_FUNKO_SORT
  if (sort !== DEFAULT_FUNKO_SORT) params.set('sort', sort)
  if (opts.page && opts.page > 1) params.set('page', String(opts.page))
  if (opts.q?.trim()) params.set('q', opts.q.trim())
  const qs = params.toString()
  return `/funko${qs ? `?${qs}` : ''}`
}
