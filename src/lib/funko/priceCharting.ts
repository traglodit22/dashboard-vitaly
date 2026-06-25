import fs from 'fs/promises'
import path from 'path'

const INDEX_DIR = path.join(process.cwd(), 'scripts/data/funko/pop-index')

/** Slug PriceCharting → slug дашборда. */
export const PRICECHARTING_SLUG: Record<string, string> = {
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

function pcSlugForCategory(categorySlug: string): string | null {
  return PRICECHARTING_SLUG[categorySlug] ?? null
}

function cachePath(categorySlug: string): string {
  return path.join(INDEX_DIR, `${categorySlug}.pricecharting.json`)
}

export function parsePriceChartingTableHtml(html: string): Record<string, string[]> {
  const index: Record<string, Set<string>> = {}
  const re = />([A-Za-z0-9][^<]{2,100}?)\s*#(\d{1,5})(?:\/|<)/g
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

export function parsePriceChartingSearchHtml(
  html: string,
  popNumber: number,
  pcSlug: string,
): string[] {
  const out = new Set<string>()
  const pop = String(popNumber)
  const prefix = `funko-pop-${pcSlug}`
  const linkRe = new RegExp(
    `/game/${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^"]+"[^>]*>([^<]+)</a>`,
    'gi',
  )
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    const title = m[1].replace(/\s+/g, ' ').trim()
    if (!title.includes(`#${pop}`) && !title.endsWith(pop)) continue
    out.add(title)
  }
  return [...out]
}

async function readCache(categorySlug: string): Promise<Record<string, string[]>> {
  try {
    const raw = await fs.readFile(cachePath(categorySlug), 'utf8')
    return JSON.parse(raw) as Record<string, string[]>
  } catch {
    return {}
  }
}

async function writeCache(categorySlug: string, data: Record<string, string[]>): Promise<void> {
  await fs.mkdir(INDEX_DIR, { recursive: true })
  await fs.writeFile(cachePath(categorySlug), JSON.stringify(data, null, 2))
}

const searchInflight = new Map<string, Promise<string[]>>()

/** Подтянуть названия по № Pop через поиск PriceCharting (и сохранить в кэш). */
export async function fetchPriceChartingPopTitles(
  categorySlug: string,
  popNumber: number,
): Promise<string[]> {
  const pcSlug = pcSlugForCategory(categorySlug)
  if (!pcSlug) return []

  const key = `${categorySlug}:${popNumber}`
  const pending = searchInflight.get(key)
  if (pending) return pending

  const task = (async () => {
    const q = encodeURIComponent(`funko ${pcSlug.replace(/-/g, ' ')} ${popNumber}`)
    const url = `https://www.pricecharting.com/search-products?type=prices&q=${q}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DashBoardTrag/1.0)' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return []

    const titles = parsePriceChartingSearchHtml(await res.text(), popNumber, pcSlug)
    if (!titles.length) return []

    const cache = await readCache(categorySlug)
    const popKey = String(popNumber)
    const merged = new Set([...(cache[popKey] ?? []), ...titles])
    cache[popKey] = [...merged].sort()
    await writeCache(categorySlug, cache)
    return cache[popKey]
  })().finally(() => {
    searchInflight.delete(key)
  })

  searchInflight.set(key, task)
  return task
}

/** Названия из локального кэша PriceCharting + догрузка при промахе. */
export async function loadPriceChartingPopTitles(
  categorySlug: string,
  popNumber: number,
): Promise<string[]> {
  const popKey = String(popNumber)
  const cache = await readCache(categorySlug)
  if (cache[popKey]?.length) return cache[popKey]

  const alt = categorySlug.replace(/-/g, '')
  if (alt !== categorySlug) {
    const altCache = await readCache(alt)
    if (altCache[popKey]?.length) return altCache[popKey]
  }

  return fetchPriceChartingPopTitles(categorySlug, popNumber)
}
