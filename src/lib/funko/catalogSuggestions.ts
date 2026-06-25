import fs from 'fs/promises'
import path from 'path'
import {
  buildCatalogSearchNeedle,
  catalogEntryMatchesPop,
  catalogEntryPopNumber,
  catalogMatchMinScore,
  hasTextSearchHints,
  indexTitleMatchesQuery,
  scoreCatalogEntry,
  type CatalogMatchQuery,
} from '@/lib/funko/catalogMatch'
import { getCategoryDef } from '@/lib/funko/categoryConfig'
import { cleanPopIndexTitle, loadAllPopIndexTitles } from '@/lib/funko/popIndex'
import {
  clearPriceChartingPageCache,
  isHobbydbImageUrl,
  suggestPriceChartingImages,
} from '@/lib/funko/priceChartingImages'
import type { FunkoImageSuggestion, FunkoImportRow, FunkoTitleSuggestion } from '@/lib/funko/types'

const DATA_DIR = path.join(process.cwd(), 'scripts/data/funko')

const catalogCache = new Map<string, FunkoImportRow[]>()

async function loadCatalog(categorySlug: string): Promise<FunkoImportRow[]> {
  const cached = catalogCache.get(categorySlug)
  if (cached) return cached

  const def = getCategoryDef(categorySlug)
  if (!def) {
    catalogCache.set(categorySlug, [])
    return []
  }

  try {
    const raw = await fs.readFile(path.join(DATA_DIR, def.catalogFile), 'utf8')
    const rows = JSON.parse(raw) as FunkoImportRow[]
    catalogCache.set(categorySlug, rows)
    return rows
  } catch {
    catalogCache.set(categorySlug, [])
    return []
  }
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

/** Подбор по локальному каталогу (название + № Pop), без hobbydb URL. */
function scoreCatalogImageEntry(
  entry: FunkoImportRow,
  opts: { popNumber: number | null; title: string; subseries: string },
): number {
  let score = 0
  const entryPop = catalogEntryPopNumber(entry)
  if (opts.popNumber != null && entryPop === opts.popNumber) score += 12
  if (opts.popNumber != null && catalogEntryMatchesPop(entry, opts.popNumber)) score += 10

  const needle = [opts.subseries, opts.title].filter(Boolean).join(' ')
  if (opts.title && norm(entry.title).includes(norm(opts.title))) score += 6
  score += tokenOverlap(needle, entry.title) * 2

  const subFirst = opts.subseries.trim().split(/\s+/)[0]
  if (subFirst && norm(entry.title).includes(norm(subFirst))) score += 2

  return score
}

export async function suggestCatalogImages(opts: {
  categorySlug: string
  popNumber: number | null
  title: string
  subseries?: string
  categorySeries?: string
  limit?: number
}): Promise<FunkoImageSuggestion[]> {
  clearPriceChartingPageCache()

  const catalog = await loadCatalog(opts.categorySlug)
  const subseries = opts.subseries ?? ''
  const limit = opts.limit ?? 24

  const catalogCandidates: Array<{ title: string; handle: string; score: number }> = []
  for (const entry of catalog) {
    const score = scoreCatalogImageEntry(entry, {
      popNumber: opts.popNumber,
      title: opts.title,
      subseries,
    })
    if (score < 4) continue
    catalogCandidates.push({ title: entry.title, handle: entry.handle, score })
  }
  catalogCandidates.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))

  const indexTitles =
    opts.popNumber != null
      ? await loadAllPopIndexTitles(opts.categorySlug, opts.popNumber)
      : []

  const candidateTitles = [
    ...catalogCandidates.map((c) => c.title),
    ...indexTitles.map((t) => cleanPopIndexTitle(t)),
    opts.title,
    subseries,
  ].filter(Boolean)

  const pcResults = await suggestPriceChartingImages({
    categorySlug: opts.categorySlug,
    popNumber: opts.popNumber,
    title: opts.title,
    subseries,
    candidateTitles,
    limit,
  })

  const handleByTitle = new Map(
    catalogCandidates.map((c) => [norm(c.title), c.handle]),
  )

  return pcResults
    .map((item) => {
      const handle = handleByTitle.get(norm(item.title)) ?? item.handle
      const catalogScore = catalogCandidates.find((c) => norm(c.title) === norm(item.title))?.score ?? 0
      return { ...item, handle, score: item.score + catalogScore }
    })
    .filter((item) => !isHobbydbImageUrl(item.imageUrl))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
}

function titleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export async function suggestCatalogTitles(opts: {
  categorySlug: string
  popNumber: number | null
  title?: string
  subseries?: string
  categorySeries?: string
  limit?: number
}): Promise<FunkoTitleSuggestion[]> {
  const limit = opts.limit ?? 10
  const byTitle = new Map<string, FunkoTitleSuggestion>()
  const categorySeries =
    opts.categorySeries ?? getCategoryDef(opts.categorySlug)?.name ?? ''

  const query: CatalogMatchQuery = {
    popNumber: opts.popNumber,
    title: opts.title ?? '',
    subseries: opts.subseries ?? '',
    categorySeries,
  }
  const textHints = hasTextSearchHints(query)

  function add(title: string, popNumber: number | null, score: number) {
    const clean = cleanPopIndexTitle(title)
    if (clean.length < 2) return
    const key = titleKey(clean)
    const prev = byTitle.get(key)
    if (!prev || score > prev.score) {
      byTitle.set(key, { title: clean, popNumber, score })
    }
  }

  if (opts.popNumber != null) {
    for (const t of await loadAllPopIndexTitles(opts.categorySlug, opts.popNumber)) {
      if (textHints && !indexTitleMatchesQuery(t, query)) continue
      add(t, opts.popNumber, textHints ? 18 : 30)
    }
  }

  const catalog = await loadCatalog(opts.categorySlug)

  if (opts.popNumber != null && !textHints) {
    for (const entry of catalog) {
      if (!catalogEntryMatchesPop(entry, opts.popNumber)) continue
      add(entry.title, catalogEntryPopNumber(entry), 26)
    }
  }

  if (textHints) {
    for (const entry of catalog) {
      const entryPop = catalogEntryPopNumber(entry)
      const score = scoreCatalogEntry(entry, query)
      if (score < catalogMatchMinScore(query, entryPop)) continue
      add(entry.title, entryPop, score)
    }
  }

  return [...byTitle.values()]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ru'))
    .slice(0, limit)
}

export { buildCatalogSearchNeedle }
