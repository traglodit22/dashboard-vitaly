import fs from 'fs/promises'
import path from 'path'
import type { CollectionImportRow } from '@/lib/funko/matchCatalogImage'
import { loadPriceChartingPopTitles } from '@/lib/funko/priceCharting'

const DATA_DIR = path.join(process.cwd(), 'scripts/data/funko')
const INDEX_DIR = path.join(DATA_DIR, 'pop-index')

function decodeHtmlEntities(title: string): string {
  return title
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

export function cleanPopIndexTitle(title: string): string {
  const decoded = decodeHtmlEntities(title.trim())
  const md = decoded.match(/^\[([^\]]+)\]/)
  let t = md ? md[1] : decoded
  t = t.replace(/\s*#\d+.*$/, '').replace(/\s+/g, ' ').trim()
  return t
}

async function readIndexFile(file: string): Promise<Record<string, string[]>> {
  try {
    const raw = await fs.readFile(path.join(INDEX_DIR, file), 'utf8')
    return JSON.parse(raw) as Record<string, string[]>
  } catch {
    return {}
  }
}

type MasterEntry = string | { title: string; categories?: string[] }

async function readMasterIndex(): Promise<Record<string, MasterEntry>> {
  try {
    const raw = await fs.readFile(path.join(INDEX_DIR, 'master.json'), 'utf8')
    return JSON.parse(raw) as Record<string, MasterEntry>
  } catch {
    return {}
  }
}

function masterTitle(entry: MasterEntry): string {
  return typeof entry === 'string' ? entry : entry.title
}

function masterMatchesCategory(entry: MasterEntry, categorySlug: string): boolean {
  if (typeof entry === 'string') return true
  const cats = entry.categories
  return !cats?.length || cats.includes(categorySlug)
}

/** Названия по № Pop из pricecharting / fandom для категории. */
export async function loadCategoryPopIndexTitles(
  categorySlug: string,
  popNumber: number,
): Promise<string[]> {
  const out = new Set<string>()
  const key = String(popNumber)

  const fandom = await readIndexFile(`${categorySlug}.fandom.json`)
  for (const t of fandom[key] ?? []) {
    const clean = cleanPopIndexTitle(t)
    if (clean.length > 1) out.add(clean)
  }

  for (const t of await loadPriceChartingPopTitles(categorySlug, popNumber)) {
    const clean = cleanPopIndexTitle(t)
    if (clean.length > 1) out.add(clean)
  }

  return [...out]
}

/** Глобальные мастер-номера Funko (#1240 и т.д.). */
export async function loadMasterPopIndexTitles(
  categorySlug: string,
  popNumber: number,
): Promise<string[]> {
  const data = await readMasterIndex()
  const entry = data[String(popNumber)]
  if (!entry || !masterMatchesCategory(entry, categorySlug)) return []
  const clean = cleanPopIndexTitle(masterTitle(entry))
  return clean.length > 1 ? [clean] : []
}

/** Из PDF-коллекции пользователя. */
export async function loadCollectionPopIndexTitles(
  categorySlug: string,
  popNumber: number,
): Promise<string[]> {
  try {
    const raw = await fs.readFile(
      path.join(DATA_DIR, `collection-${categorySlug}.json`),
      'utf8',
    )
    const rows = JSON.parse(raw) as CollectionImportRow[]
    const out = new Set<string>()
    for (const row of rows) {
      if (row.popNumber !== popNumber) continue
      const title = (row.title || `${row.subseries} — ${row.name}`).trim()
      const clean = cleanPopIndexTitle(title)
      if (clean.length > 1) out.add(clean)
    }
    return [...out]
  } catch {
    return []
  }
}

export async function loadAllPopIndexTitles(
  categorySlug: string,
  popNumber: number,
): Promise<string[]> {
  const out = new Set<string>()
  for (const loader of [
    loadMasterPopIndexTitles,
    loadCategoryPopIndexTitles,
    loadCollectionPopIndexTitles,
  ]) {
    for (const t of await loader(categorySlug, popNumber)) out.add(t)
  }
  return [...out]
}
