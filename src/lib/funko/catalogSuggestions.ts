import fs from 'fs/promises'
import path from 'path'
import { getCategoryDef } from '@/lib/funko/categoryConfig'
import { parsePopNumber } from '@/lib/funko/parsePopNumber'
import type { FunkoImageSuggestion, FunkoImportRow } from '@/lib/funko/types'

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

function scoreEntry(
  entry: FunkoImportRow,
  opts: { popNumber: number | null; title: string; subseries: string },
): number {
  let score = 0
  const entryPop = parsePopNumber(entry.title)
  if (opts.popNumber != null && entryPop === opts.popNumber) score += 12
  const needle = [opts.subseries, opts.title].filter(Boolean).join(' ')
  if (opts.title && norm(entry.title).includes(norm(opts.title))) score += 6
  score += tokenOverlap(needle, entry.title) * 2
  if (opts.subseries && norm(entry.title).includes(norm(opts.subseries.split(/\s+/)[0]))) {
    score += 2
  }
  return score
}

export async function suggestCatalogImages(opts: {
  categorySlug: string
  popNumber: number | null
  title: string
  subseries?: string
  limit?: number
}): Promise<FunkoImageSuggestion[]> {
  const catalog = await loadCatalog(opts.categorySlug)
  const subseries = opts.subseries ?? ''
  const limit = opts.limit ?? 12
  const seen = new Set<string>()

  const ranked: FunkoImageSuggestion[] = []
  for (const entry of catalog) {
    if (!entry.imageUrl || seen.has(entry.imageUrl)) continue
    const score = scoreEntry(entry, {
      popNumber: opts.popNumber,
      title: opts.title,
      subseries,
    })
    if (score < 4) continue
    seen.add(entry.imageUrl)
    ranked.push({
      handle: entry.handle,
      title: entry.title,
      imageUrl: entry.imageUrl,
      score,
      popNumber: parsePopNumber(entry.title),
    })
  }

  ranked.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  return ranked.slice(0, limit)
}
