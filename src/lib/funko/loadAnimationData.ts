import fs from 'fs/promises'
import path from 'path'
import type { FunkoImportRow } from '@/lib/funko/types'

const CSV_URL =
  'https://raw.githubusercontent.com/kennymkchan/funko-pop-data/master/funko_pop.csv'

const DATA_FILE = path.join(process.cwd(), 'scripts/data/funko/animations.json')

/** Простой CSV-парсер для funko_pop.csv (поля с запятыми внутри кавычек). */
export function parseFunkoCsv(text: string): FunkoImportRow[] {
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
    if (!seriesRaw.includes('Pop! Animation')) continue

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

export async function loadAnimationImportRows(
  source: 'bundled' | 'download' = 'bundled',
): Promise<FunkoImportRow[]> {
  if (source === 'bundled') {
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8')
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
  return parseFunkoCsv(text)
}
