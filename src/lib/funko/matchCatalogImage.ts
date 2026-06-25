import fs from 'fs/promises'
import path from 'path'
import { parsePopNumber } from '@/lib/funko/parsePopNumber'
import type { FunkoImportRow } from '@/lib/funko/types'

const CATALOG_FILE = path.join(process.cwd(), 'scripts/data/funko/animations.json')

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

let catalogCache: FunkoImportRow[] | null = null

async function loadCatalog(): Promise<FunkoImportRow[]> {
  if (catalogCache) return catalogCache
  try {
    const raw = await fs.readFile(CATALOG_FILE, 'utf8')
    catalogCache = JSON.parse(raw) as FunkoImportRow[]
  } catch {
    catalogCache = []
  }
  return catalogCache
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

export async function matchCatalogImage(row: CollectionImportRow): Promise<string | null> {
  const catalog = await loadCatalog()
  if (!catalog.length) return null

  const needle = [row.subseries, row.name].filter(Boolean).join(' ')
  let best: { imageUrl: string; score: number } | null = null

  for (const entry of catalog) {
    let score = 0
    const entryPop = parsePopNumber(entry.title)
    if (row.popNumber != null && entryPop === row.popNumber) score += 12
    if (row.name && norm(entry.title).includes(norm(row.name))) score += 6
    score += tokenOverlap(needle, entry.title) * 2
    if (row.subseries && norm(entry.title).includes(norm(row.subseries.split(/\s+/)[0]))) {
      score += 2
    }
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
  const base = norm(row.name || row.subseries || `pop-${row.popNumber ?? index}`)
    .replace(/\s+/g, '-')
    .slice(0, 48)
  const pop = row.popNumber ?? index
  return `col-${pop}-${base || 'item'}`
}

export async function loadCollectionJson(): Promise<CollectionImportRow[]> {
  const file = path.join(process.cwd(), 'scripts/data/funko/collection-animation.json')
  const raw = await fs.readFile(file, 'utf8')
  return JSON.parse(raw) as CollectionImportRow[]
}
