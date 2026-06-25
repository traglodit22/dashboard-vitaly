import { parsePopNumber } from '@/lib/funko/parsePopNumber'
import type { FunkoImportRow } from '@/lib/funko/types'

export function extractPopFromHandle(handle: string): number | null {
  for (const re of [/model-(\d+)(?:$|-)/i, /#(\d+)/, /-(\d{1,4})$/, /^(\d{1,4})-/]) {
    const m = handle.match(re)
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return null
}

export function catalogEntryPopNumber(entry: FunkoImportRow): number | null {
  return parsePopNumber(entry.title) ?? extractPopFromHandle(entry.handle)
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(norm(a).split(/\s+/).filter((t) => t.length > 2))
  const tb = new Set(norm(b).split(/\s+/).filter((t) => t.length > 2))
  if (!ta.size || !tb.size) return 0
  let n = 0
  for (const t of ta) if (tb.has(t)) n++
  return n
}

export interface CatalogMatchQuery {
  popNumber: number | null
  title: string
  subseries?: string
  categorySeries?: string
}

export function buildCatalogSearchNeedle(query: CatalogMatchQuery): string {
  return [
    query.popNumber != null ? `#${query.popNumber}` : '',
    query.popNumber != null ? String(query.popNumber) : '',
    query.subseries,
    query.title,
    query.categorySeries,
  ]
    .filter(Boolean)
    .join(' ')
}

export function scoreCatalogEntry(entry: FunkoImportRow, query: CatalogMatchQuery): number {
  let score = 0
  const entryPop = catalogEntryPopNumber(entry)
  const subseries = query.subseries ?? ''
  const needle = buildCatalogSearchNeedle(query)
  const entrySeriesText = entry.series.join(' ')
  const entryHaystack = `${entry.title} ${entry.handle.replace(/-/g, ' ')} ${entrySeriesText}`

  if (query.popNumber != null && entryPop === query.popNumber) score += 24
  if (query.popNumber != null && norm(entryHaystack).includes(String(query.popNumber))) score += 4

  if (query.title && norm(entry.title).includes(norm(query.title))) score += 8
  score += tokenOverlap(needle, entry.title) * 2
  score += tokenOverlap(needle, entryHaystack) * 1

  if (subseries) {
    if (norm(entrySeriesText).includes(norm(subseries))) score += 6
    if (norm(entry.title).includes(norm(subseries))) score += 4
    const first = subseries.split(/\s+/)[0]
    if (first.length > 2 && norm(entryHaystack).includes(norm(first))) score += 2
  }

  if (query.categorySeries && norm(entrySeriesText).includes(norm(query.categorySeries))) {
    score += 2
  }

  return score
}

export function catalogMatchMinScore(query: CatalogMatchQuery, entryPop: number | null): number {
  if (query.popNumber != null && entryPop === query.popNumber) return 1
  return 4
}
