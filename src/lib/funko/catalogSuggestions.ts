import fs from 'fs/promises'
import path from 'path'
import {
  buildCatalogSearchNeedle,
  catalogEntryPopNumber,
  catalogMatchMinScore,
  scoreCatalogEntry,
  type CatalogMatchQuery,
} from '@/lib/funko/catalogMatch'
import { getCategoryDef } from '@/lib/funko/categoryConfig'
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

export async function suggestCatalogImages(opts: {
  categorySlug: string
  popNumber: number | null
  title: string
  subseries?: string
  categorySeries?: string
  limit?: number
}): Promise<FunkoImageSuggestion[]> {
  const catalog = await loadCatalog(opts.categorySlug)
  const query: CatalogMatchQuery = {
    popNumber: opts.popNumber,
    title: opts.title,
    subseries: opts.subseries ?? '',
    categorySeries: opts.categorySeries ?? getCategoryDef(opts.categorySlug)?.name,
  }
  const limit = opts.limit ?? 12
  const seen = new Set<string>()

  const ranked: FunkoImageSuggestion[] = []
  for (const entry of catalog) {
    if (!entry.imageUrl || seen.has(entry.imageUrl)) continue
    const entryPop = catalogEntryPopNumber(entry)
    const score = scoreCatalogEntry(entry, query)
    if (score < catalogMatchMinScore(query, entryPop)) continue
    seen.add(entry.imageUrl)
    ranked.push({
      handle: entry.handle,
      title: entry.title,
      imageUrl: entry.imageUrl,
      score,
      popNumber: entryPop,
    })
  }

  ranked.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  return ranked.slice(0, limit)
}

function cleanSuggestionTitle(title: string): string {
  const md = title.trim().match(/^\[([^\]]+)\]/)
  let t = md ? md[1] : title.trim()
  t = t.replace(/\s*#\d+.*$/, '').replace(/\s+/g, ' ').trim()
  return t
}

function titleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function loadPopIndexTitles(categorySlug: string, popNumber: number): Promise<string[]> {
  const dir = path.join(DATA_DIR, 'pop-index')
  const out = new Set<string>()
  const files = [`${categorySlug}.fandom.json`, `${categorySlug}.pricecharting.json`]

  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(dir, file), 'utf8')
      const data = JSON.parse(raw) as Record<string, string[]>
      for (const t of data[String(popNumber)] ?? []) {
        const clean = cleanSuggestionTitle(t)
        if (clean.length > 1) out.add(clean)
      }
    } catch {
      // index optional
    }
  }
  return [...out]
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

  function add(title: string, popNumber: number | null, score: number) {
    const clean = cleanSuggestionTitle(title)
    if (clean.length < 2) return
    const key = titleKey(clean)
    const prev = byTitle.get(key)
    if (!prev || score > prev.score) {
      byTitle.set(key, { title: clean, popNumber, score })
    }
  }

  if (opts.popNumber != null) {
    for (const t of await loadPopIndexTitles(opts.categorySlug, opts.popNumber)) {
      add(t, opts.popNumber, 32)
    }
  }

  const catalog = await loadCatalog(opts.categorySlug)
  const query: CatalogMatchQuery = {
    popNumber: opts.popNumber,
    title: opts.popNumber != null ? '' : (opts.title ?? ''),
    subseries: opts.subseries ?? '',
    categorySeries,
  }

  for (const entry of catalog) {
    const entryPop = catalogEntryPopNumber(entry)
    const score = scoreCatalogEntry(entry, query)
    if (score < catalogMatchMinScore(query, entryPop)) continue
    add(entry.title, entryPop, score)
  }

  return [...byTitle.values()]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ru'))
    .slice(0, limit)
}

export { buildCatalogSearchNeedle }
