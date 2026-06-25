import { parsePopNumber } from '@/lib/funko/parsePopNumber'
import type { FunkoImportRow } from '@/lib/funko/types'

/** № Pop из handle — только явные model-/pop- префиксы (не «k-9» и т.п.). */
export function extractPopFromHandle(handle: string): number | null {
  for (const re of [/(?:^|-)model-(\d+)(?:$|-)/i, /(?:^|-)pop-(\d+)(?:$|-)/i]) {
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

export function hasExplicitPopInTitle(entry: FunkoImportRow, popNumber: number): boolean {
  if (parsePopNumber(entry.title) === popNumber) return true
  return new RegExp(`#${popNumber}(\\D|$)`).test(entry.title)
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const PLACEHOLDER_TITLES = new Set(
  [
    'animation',
    'marvel',
    'movies',
    'games',
    'heroes',
    'disney',
    'tv',
    'asia',
    'star wars',
    'starwars',
    'sport',
    'soda',
    'rocks',
    'retro',
    'gold',
    'harry potter',
    'game of thrones',
    'pop animation',
    'pop marvel',
    'pop movies',
    'pop games',
    'pop disney',
    'pop television',
  ].map(norm),
)

function isPlaceholderText(text: string): boolean {
  const n = norm(text)
  return !n || PLACEHOLDER_TITLES.has(n)
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

/** Есть имя/подсерия для текстового поиска (не только № Pop). */
export function hasTextSearchHints(query: CatalogMatchQuery): boolean {
  const subseries = (query.subseries ?? '').trim()
  if (subseries && !isPlaceholderText(subseries)) return true

  const title = (query.title ?? '').trim()
  if (!title || isPlaceholderText(title)) return false

  const dash = title.match(/\s*[—–-]\s*(.+)$/)
  const name = (dash?.[1] ?? title).trim()
  return name.length > 0 && !isPlaceholderText(name)
}

/** Подсказки из названия/подсерии для текстового поиска. */
export function extractSearchHints(query: CatalogMatchQuery): string[] {
  const hints = new Set<string>()
  const subseries = (query.subseries ?? '').trim()
  const title = (query.title ?? '').trim()

  if (subseries && !isPlaceholderText(subseries)) hints.add(subseries)

  if (title && !isPlaceholderText(title)) {
    const dash = title.match(/\s*[—–-]\s*(.+)$/)
    const name = (dash?.[1] ?? title).trim()
    if (name && !isPlaceholderText(name)) hints.add(name)
    if (!dash && !isPlaceholderText(title)) hints.add(title)
  }

  const blob = norm([subseries, title].filter(Boolean).join(' '))
  if (blob.includes('ball z') || blob === 'ball z') {
    hints.add('Dragon Ball Z')
    hints.add('Dragon Ball')
  }

  return [...hints].filter((h) => h.length > 0)
}

export function buildCatalogSearchNeedle(query: CatalogMatchQuery): string {
  return extractSearchHints(query).join(' ')
}

const NAME_TOKEN_STOPWORDS = new Set(
  ['evil', 'good', 'bad', 'dark', 'super', 'the', 'new', 'old', 'with', 'vs', 'and'].map(norm),
)

export function extractNameTokens(query: CatalogMatchQuery): string[] {
  const tokens = new Set<string>()
  for (const hint of extractSearchHints(query)) {
    const words = norm(hint)
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !NAME_TOKEN_STOPWORDS.has(w))
    for (const w of words.filter((w) => w.length >= 5)) tokens.add(w)
    if (words[0] && words[0].length >= 4) tokens.add(words[0])
  }
  return [...tokens]
}

/** Дополнить запрос подсерией из названия (Evil Inuyasha → Inuyasha). */
export function enrichQueryForImageSearch(query: CatalogMatchQuery): CatalogMatchQuery {
  if ((query.subseries ?? '').trim()) return query
  const tokens = extractNameTokens(query)
    .filter((t) => t.length >= 5)
    .sort((a, b) => b.length - a.length)
  if (!tokens[0]) return query
  return { ...query, subseries: tokens[0] }
}

export function catalogImageMinScore(
  query: CatalogMatchQuery,
  entry: FunkoImportRow,
  score: number,
): boolean {
  if (query.popNumber != null && catalogEntryMatchesPop(entry, query.popNumber)) return true
  if (score >= 18) return true

  const enriched = enrichQueryForImageSearch(query)
  const entryNorm = norm(entry.title)

  for (const token of extractNameTokens(enriched)) {
    if (token.length >= 4 && entryNorm.includes(token)) return true
  }

  for (const hint of extractSearchHints(enriched)) {
    const nh = norm(hint)
    if (nh.length >= 4 && entryNorm.includes(nh)) return true
  }

  return false
}

export function scoreCatalogEntryForImage(
  entry: FunkoImportRow,
  query: CatalogMatchQuery,
  indexTitles: string[] = [],
): number {
  const enriched = enrichQueryForImageSearch(query)
  let score = scoreCatalogEntry(entry, enriched)
  const entryNorm = norm(entry.title)

  for (const token of extractNameTokens(enriched)) {
    if (entryNorm.includes(token)) score += 8
  }

  for (const idxTitle of indexTitles) {
    const nt = norm(cleanIndexTitleForMatch(idxTitle))
    if (!nt) continue
    if (entryNorm.includes(nt)) score += 12
    else if (entryNorm.length >= 5 && nt.includes(entryNorm)) score += 12
    score += tokenOverlap(idxTitle, entry.title) * 2
  }

  return score
}

function cleanIndexTitleForMatch(title: string): string {
  return title.replace(/\s*#\d+.*$/, '').replace(/\s+/g, ' ').trim()
}

export function catalogEntryMatchesPop(
  entry: FunkoImportRow,
  popNumber: number,
): boolean {
  return (
    catalogEntryPopNumber(entry) === popNumber || hasExplicitPopInTitle(entry, popNumber)
  )
}

export function scoreCatalogEntry(entry: FunkoImportRow, query: CatalogMatchQuery): number {
  let score = 0
  const entryPop = catalogEntryPopNumber(entry)
  const hints = extractSearchHints(query)
  const entrySeriesText = entry.series.join(' ')
  const entryHaystack = `${entry.title} ${entry.handle.replace(/-/g, ' ')} ${entrySeriesText}`
  const entryNorm = norm(entryHaystack)

  if (query.popNumber != null && entryPop === query.popNumber) score += 24
  if (query.popNumber != null && hasExplicitPopInTitle(entry, query.popNumber)) score += 22

  for (const hint of hints) {
    const nh = norm(hint)
    if (nh.length < 2) continue
    if (entryNorm.includes(nh)) score += 12
    score += tokenOverlap(hint, entry.title) * 3
  }

  const subseries = (query.subseries ?? '').trim()
  if (subseries && !isPlaceholderText(subseries)) {
    const ns = norm(subseries)
    if (norm(entrySeriesText).includes(ns)) score += 10
    if (norm(entry.title).includes(ns)) score += 8
  }

  if (query.categorySeries && norm(entrySeriesText).includes(norm(query.categorySeries))) {
    score += 2
  }

  return score
}

export function catalogMatchMinScore(query: CatalogMatchQuery, entryPop: number | null): number {
  if (query.popNumber != null && entryPop === query.popNumber) return 1
  if (hasTextSearchHints(query)) return 8
  return 20
}

export function indexTitleMatchesQuery(suggestionTitle: string, query: CatalogMatchQuery): boolean {
  const hints = extractSearchHints(query)
  if (!hints.length) return true

  const st = norm(suggestionTitle)
  for (const hint of hints) {
    const nh = norm(hint)
    if (nh.length < 3) continue
    if (st.includes(nh) || nh.includes(st)) return true
    for (const token of nh.split(/\s+/).filter((t) => t.length > 3)) {
      if (st.includes(token)) return true
    }
  }
  return false
}
