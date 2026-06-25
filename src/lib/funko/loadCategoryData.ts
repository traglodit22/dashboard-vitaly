import fs from 'fs/promises'
import path from 'path'
import {
  categorySeriesFilters,
  FUNKO_CATEGORY_DEFS,
  getCategoryDef,
  hasCatalogSource,
  type FunkoCategoryDef,
} from '@/lib/funko/categoryConfig'
import type { FunkoImportRow } from '@/lib/funko/types'

const CSV_URL =
  'https://raw.githubusercontent.com/kennymkchan/funko-pop-data/master/funko_pop.csv'

const DATA_DIR = path.join(process.cwd(), 'scripts/data/funko')

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

/** CSV-парсер funko_pop.csv с фильтром по одной или нескольким сериям. */
export function parseFunkoCsv(
  text: string,
  seriesFilters: string | string[],
): FunkoImportRow[] {
  const filters = Array.isArray(seriesFilters) ? seriesFilters : [seriesFilters]
  const lines = text.split(/\r?\n/)
  if (!lines.length) return []

  const header = splitCsvLine(lines[0])
  const handleIdx = header.indexOf('handle')
  const titleIdx = header.indexOf('title')
  const imageIdx = header.indexOf('imageName')
  const seriesIdx = header.indexOf('series')
  if (handleIdx < 0 || titleIdx < 0 || imageIdx < 0 || seriesIdx < 0) {
    throw new Error('Неожиданный формат CSV funko_pop.csv')
  }

  const rows: FunkoImportRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const cols = splitCsvLine(line)
    const seriesRaw = cols[seriesIdx] ?? ''
    if (!filters.some((f) => seriesRaw.includes(f))) continue

    rows.push({
      handle: cols[handleIdx]?.trim() ?? '',
      title: cols[titleIdx]?.trim() ?? '',
      imageUrl: cols[imageIdx]?.trim() ?? '',
      series: seriesRaw
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean),
    })
  }
  return rows.filter((r) => r.handle && r.title)
}

function catalogPath(def: FunkoCategoryDef): string {
  return path.join(DATA_DIR, def.catalogFile)
}

export async function loadCategoryImportRows(
  slug: string,
  source: 'bundled' | 'download' = 'bundled',
): Promise<FunkoImportRow[]> {
  const def = getCategoryDef(slug)
  if (!def) throw new Error(`Неизвестная категория: ${slug}`)
  if (!hasCatalogSource(def)) return []

  const filters = categorySeriesFilters(def)

  if (source === 'bundled') {
    try {
      const raw = await fs.readFile(catalogPath(def), 'utf8')
      return JSON.parse(raw) as FunkoImportRow[]
    } catch {
      // fallback to download
    }
  }

  const res = await fetch(CSV_URL)
  if (!res.ok) {
    throw new Error(`Не удалось скачать CSV: HTTP ${res.status}`)
  }
  const text = await res.text()
  return parseFunkoCsv(text, filters)
}

export function listImportableCategories(): FunkoCategoryDef[] {
  return FUNKO_CATEGORY_DEFS.filter(hasCatalogSource)
}
