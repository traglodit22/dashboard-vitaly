import fs from 'fs/promises'
import path from 'path'
import {
  catalogEntryPopNumber,
  catalogMatchMinScore,
  scoreCatalogEntry,
} from '@/lib/funko/catalogMatch'
import { getCategoryDef } from '@/lib/funko/categoryConfig'
import type { FunkoImportRow } from '@/lib/funko/types'

export interface CollectionImportRow {
  popNumber: number | null
  subseries: string
  name: string
  title: string
  features: string
  notes: string | null
  owned: boolean
  inTransit: boolean
  hasDuplicates: boolean
  quantity: number
  sortOrder: number
}

const catalogCache = new Map<string, FunkoImportRow[]>()

async function loadCatalog(categorySlug: string): Promise<FunkoImportRow[]> {
  const cached = catalogCache.get(categorySlug)
  if (cached) return cached

  const def = getCategoryDef(categorySlug)
  const file = path.join(
    process.cwd(),
    'scripts/data/funko',
    def?.catalogFile ?? `${categorySlug}.json`,
  )

  try {
    const raw = await fs.readFile(file, 'utf8')
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

export async function matchCatalogImage(
  row: CollectionImportRow,
  categorySlug: string,
): Promise<string | null> {
  const catalog = await loadCatalog(categorySlug)
  if (!catalog.length) return null

  const def = getCategoryDef(categorySlug)
  const query = {
    popNumber: row.popNumber,
    title: row.name || row.title,
    subseries: row.subseries,
    categorySeries: def?.name,
  }

  let best: { imageUrl: string; score: number } | null = null

  for (const entry of catalog) {
    const entryPop = catalogEntryPopNumber(entry)
    const score = scoreCatalogEntry(entry, query)
    if (score < catalogMatchMinScore(query, entryPop)) continue
    if (score > (best?.score ?? 0) && entry.imageUrl) {
      best = { imageUrl: entry.imageUrl, score }
    }
  }

  if (!best) return null
  if (row.popNumber != null && best.score < 8) return null
  if (row.popNumber == null && best.score < 6) return null
  return best.imageUrl
}

export function collectionHandle(row: CollectionImportRow, index: number): string {
  const sort = row.sortOrder ?? index
  const base = norm(row.name || row.subseries || `pop-${row.popNumber ?? sort}`)
    .replace(/\s+/g, '-')
    .slice(0, 40)
  const pop = row.popNumber ?? sort
  const feat = row.features
    ? norm(row.features).replace(/\s+/g, '-').slice(0, 24)
    : ''
  return `col-${sort}-${pop}-${base}${feat ? `-${feat}` : ''}`.slice(0, 120)
}

export async function loadCollectionJson(categorySlug: string): Promise<CollectionImportRow[]> {
  const file = path.join(process.cwd(), `scripts/data/funko/collection-${categorySlug}.json`)
  const raw = await fs.readFile(file, 'utf8')
  return JSON.parse(raw) as CollectionImportRow[]
}

export async function listCollectionSlugs(): Promise<string[]> {
  const dir = path.join(process.cwd(), 'scripts/data/funko')
  const files = await fs.readdir(dir)
  return files
    .filter((f) => f.startsWith('collection-') && f.endsWith('.json'))
    .map((f) => f.slice('collection-'.length, -'.json'.length))
    .sort()
}

/** @deprecated */
export async function loadAnimationCollectionJson(): Promise<CollectionImportRow[]> {
  return loadCollectionJson('animation')
}
