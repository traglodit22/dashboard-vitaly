/**
 * Исправляет названия, где вместо фигурки указана категория.
 * Ищет имя по № Pop в индексах Fandom / PriceCharting / локальном каталоге.
 *
 *   npm run fix-funko-titles           # dry-run
 *   npm run fix-funko-titles -- --apply
 */
import fs from 'fs/promises'
import path from 'path'
import { pool, query } from '../src/lib/db/index'
import {
  categorySeriesFilters,
  FUNKO_CATEGORY_DEFS,
  getCategoryDef,
  type FunkoCategoryDef,
} from '../src/lib/funko/categoryConfig'
import { ensureFunkoSchema } from '../src/lib/funko/ensureFunko'
import { parsePopNumber } from '../src/lib/funko/parsePopNumber'
import type { FunkoImportRow } from '../src/lib/funko/types'

const DATA_DIR = path.join(process.cwd(), 'scripts/data/funko')
const INDEX_DIR = path.join(DATA_DIR, 'pop-index')
const FULL_JSON_URL =
  'https://raw.githubusercontent.com/kennymkchan/funko-pop-data/master/funko_pop.json'
const FULL_JSON_CACHE = path.join(DATA_DIR, 'funko_pop.full.json')

const PRICECHARTING_SLUG: Record<string, string> = {
  animation: 'animation',
  asia: 'asia',
  disney: 'disney',
  games: 'games',
  'game-of-thrones': 'game-of-thrones',
  'harry-potter': 'harry-potter',
  heroes: 'heroes',
  marvel: 'marvel',
  movies: 'movies',
  rocks: 'rocks',
  basketball: 'basketball',
  football: 'football',
  hockey: 'hockey',
  mlb: 'mlb',
  'sports-legends': 'sports-legends',
  snl: 'snl',
  ufc: 'ufc',
  tennis: 'tennis',
  wwe: 'wwe',
  starwars: 'star-wars',
  tv: 'television',
}

const PLACEHOLDER_TITLES = new Set(
  [
    'Star Wars',
    'Disney',
    'Marvel',
    'Movies',
    'Games',
    'Heroes',
    'Animation',
    'TV',
    'Asia',
    'Soda',
    'Rocks',
    'Retro',
    'Gold',
    'Harry Potter',
    'Game of Thrones',
    ...FUNKO_CATEGORY_DEFS.map((d) => d.name),
    ...FUNKO_CATEGORY_DEFS.map((d) => d.shortLabel),
  ].map((s) => s.trim()),
)

type PopIndex = Map<number, Set<string>>

interface BadItem {
  id: string
  slug: string
  popNumber: number
  title: string
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function seriesMatches(rowSeries: string[], filters: string[]): boolean {
  const joined = rowSeries.join(';')
  return filters.some((f) => joined.includes(f))
}

function extractPopFromHandle(handle: string): number | null {
  for (const re of [/(?:^|-)model-(\d+)(?:$|-)/i, /(?:^|-)pop-(\d+)(?:$|-)/i]) {
    const m = handle.match(re)
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return null
}

function addToIndex(index: PopIndex, pop: number, title: string) {
  const t = title.trim()
  if (!t) return
  if (!index.has(pop)) index.set(pop, new Set())
  index.get(pop)!.add(t)
}

function mergePopIndex(target: PopIndex, source: PopIndex) {
  for (const [pop, titles] of source) {
    for (const t of titles) addToIndex(target, pop, t)
  }
}

function buildCatalogPopIndex(rows: FunkoImportRow[], filters: string[]): PopIndex {
  const index: PopIndex = new Map()
  for (const row of rows) {
    if (!seriesMatches(row.series, filters)) continue
    const fromTitle = parsePopNumber(row.title)
    if (fromTitle != null) addToIndex(index, fromTitle, row.title)
    const fromHandle = extractPopFromHandle(row.handle)
    if (fromHandle != null) addToIndex(index, fromHandle, row.title)
    const hash = row.title.match(/#(\d+)/)
    if (hash) addToIndex(index, Number(hash[1]), row.title)
  }
  return index
}

function cleanCatalogTitle(title: string): string {
  let t = title.trim()
  const md = t.match(/^\[([^\]]+)\]/)
  if (md) t = md[1]
  return t
    .replace(/\s*#\d+.*$/, '')
    .replace(/\s*\[[^\]]+\]\s*/g, ' ')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickBestTitle(candidates: Set<string>): string | null {
  if (!candidates.size) return null
  const list = [...candidates]
    .map((t) => ({ raw: t, clean: cleanCatalogTitle(t) }))
    .filter((x) => x.clean.length > 1)
    .sort((a, b) => {
      const aPlain = !a.raw.includes('(') && !a.raw.includes('[') ? 0 : 1
      const bPlain = !b.raw.includes('(') && !b.raw.includes('[') ? 0 : 1
      if (aPlain !== bPlain) return aPlain - bPlain
      return a.clean.length - b.clean.length
    })
  return list[0]?.clean ?? null
}

function isBadTitle(title: string, slug: string): boolean {
  const t = title.trim()
  if (!t) return true
  if (PLACEHOLDER_TITLES.has(t)) return true
  const def = getCategoryDef(slug)
  if (!def) return false
  if (t === def.shortLabel || t === def.name) return true
  if (norm(t) === norm(def.shortLabel) || norm(t) === norm(def.name)) return true
  // «Категория — Имя» — нормально
  const dash = t.match(/^(.+?)\s*[—–-]\s*(.+)$/)
  if (dash) {
    const left = dash[1].trim()
    const right = dash[2].trim()
    if (right && !PLACEHOLDER_TITLES.has(right)) {
      if (left === def.shortLabel || left === def.name || PLACEHOLDER_TITLES.has(left)) {
        return false
      }
    }
  }
  return false
}

async function loadJsonFile<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function loadCatalogRows(def: FunkoCategoryDef): Promise<FunkoImportRow[]> {
  const file = path.join(DATA_DIR, def.catalogFile)
  return (await loadJsonFile<FunkoImportRow[]>(file)) ?? []
}

async function loadFullJsonRows(): Promise<FunkoImportRow[]> {
  const cached = await loadJsonFile<FunkoImportRow[]>(FULL_JSON_CACHE)
  if (cached) return cached
  const res = await fetch(FULL_JSON_URL)
  if (!res.ok) throw new Error(`Не удалось скачать ${FULL_JSON_URL}`)
  const rows = (await res.json()) as FunkoImportRow[]
  await fs.writeFile(FULL_JSON_CACHE, JSON.stringify(rows))
  return rows
}

function parsePriceChartingHtml(html: string): Record<string, string[]> {
  const index: Record<string, Set<string>> = {}
  const re = />([A-Za-z0-9][^<]{2,80}?)\s*#(\d{1,4})(?:\/|<)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const name = m[1].replace(/\s+/g, ' ').trim()
    const pop = m[2]
    if (!name) continue
    if (!index[pop]) index[pop] = new Set()
    index[pop].add(name)
  }
  return Object.fromEntries(
    Object.entries(index).map(([k, v]) => [k, [...v].sort()]),
  )
}

async function fetchPriceChartingIndex(slug: string): Promise<Record<string, string[]>> {
  const pcSlug = PRICECHARTING_SLUG[slug]
  if (!pcSlug) return {}
  const cacheFile = path.join(INDEX_DIR, `${slug}.pricecharting.json`)
  const cached = await loadJsonFile<Record<string, string[]>>(cacheFile)
  if (cached) return cached

  const url = `https://www.pricecharting.com/console/funko-pop-${pcSlug}?view=table`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DashBoardTrag/1.0)' },
  })
  if (!res.ok) return {}
  const html = await res.text()
  const index = parsePriceChartingHtml(html)
  await fs.mkdir(INDEX_DIR, { recursive: true })
  await fs.writeFile(cacheFile, JSON.stringify(index, null, 2))
  return index
}

async function buildCategoryIndex(slug: string, fullRows: FunkoImportRow[]): Promise<PopIndex> {
  const index: PopIndex = new Map()
  const def = getCategoryDef(slug)
  const filters = def ? categorySeriesFilters(def) : []

  if (filters.length) {
    const catalog = def ? await loadCatalogRows(def) : []
    mergePopIndex(index, buildCatalogPopIndex(catalog, filters))
    mergePopIndex(index, buildCatalogPopIndex(fullRows, filters))
  }

  const fandom = await loadJsonFile<Record<string, string[]>>(
    path.join(INDEX_DIR, `${slug}.fandom.json`),
  )
  if (fandom) {
    for (const [key, titles] of Object.entries(fandom)) {
      const pop = Number(key)
      if (Number.isFinite(pop)) for (const t of titles) addToIndex(index, pop, t)
    }
  }

  let pricecharting = await loadJsonFile<Record<string, string[]>>(
    path.join(INDEX_DIR, `${slug}.pricecharting.json`),
  )
  if (!pricecharting || !Object.keys(pricecharting).length) {
    const altSlug = PRICECHARTING_SLUG[slug]
    if (altSlug && altSlug !== slug) {
      pricecharting = await loadJsonFile<Record<string, string[]>>(
        path.join(INDEX_DIR, `${altSlug}.pricecharting.json`),
      )
    }
  }
  if (!pricecharting || !Object.keys(pricecharting).length) {
    pricecharting = await fetchPriceChartingIndex(slug)
  }
  if (pricecharting) {
    for (const [key, titles] of Object.entries(pricecharting)) {
      const pop = Number(key)
      if (Number.isFinite(pop)) for (const t of titles) addToIndex(index, pop, t)
    }
  }

  return index
}

function lookupInIndex(index: PopIndex, popNumber: number): string | null {
  return pickBestTitle(index.get(popNumber) ?? new Set())
}

async function main() {
  const apply = process.argv.includes('--apply')
  await ensureFunkoSchema()

  console.log('Загрузка индексов…')
  const fullRows = await loadFullJsonRows()
  const indexes = new Map<string, PopIndex>()

  const slugs = new Set(FUNKO_CATEGORY_DEFS.map((d) => d.slug))
  for (const slug of slugs) {
    indexes.set(slug, await buildCategoryIndex(slug, fullRows))
    const size = indexes.get(slug)!.size
    if (size) console.log(`  ${slug}: ${size} номеров в индексе`)
  }

  const rows = await query<{
    id: string
    slug: string
    title: string
    popNumber: number
  }>(
    `SELECT i.id, c.slug, i.title, i.pop_number AS "popNumber"
     FROM funko_items i
     JOIN funko_categories c ON c.id = i.category_id
     WHERE i.pop_number IS NOT NULL`,
  )

  const bad: BadItem[] = rows
    .filter((r) => isBadTitle(r.title, r.slug))
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      popNumber: r.popNumber,
      title: r.title,
    }))

  console.log(`\nНайдено ${bad.length} позиций с названием-категорией (из ${rows.length} с № Pop)`)

  let fixed = 0
  let missed = 0

  for (const item of bad) {
    const index = indexes.get(item.slug)
    const newTitle = index ? lookupInIndex(index, item.popNumber) : null
    if (!newTitle || isBadTitle(newTitle, item.slug) || norm(newTitle) === norm(item.title)) {
      missed++
      console.log(`  ? ${item.slug} №${item.popNumber}: «${item.title}» — не найдено`)
      continue
    }
    console.log(`  ${apply ? '✓' : '→'} ${item.slug} №${item.popNumber}: «${item.title}» → «${newTitle}»`)
    if (apply) {
      await query('UPDATE funko_items SET title = $2, updated_at = NOW() WHERE id = $1', [
        item.id,
        newTitle,
      ])
      fixed++
    }
  }

  console.log(
    apply
      ? `\nОбновлено: ${fixed}, не найдено: ${missed}`
      : `\nDry-run: ${bad.length - missed} можно исправить, ${missed} без совпадения. Запустите с --apply`,
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => pool.end())
