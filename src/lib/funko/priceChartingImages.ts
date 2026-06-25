import { PRICECHARTING_SLUG } from '@/lib/funko/priceCharting'
import type { FunkoImageSuggestion } from '@/lib/funko/types'

const UA = 'Mozilla/5.0 (compatible; DashBoardTrag/1.0)'
const PC_ORIGIN = 'https://www.pricecharting.com'
const PC_IMAGE_HOST = 'storage.googleapis.com/images.pricecharting.com'

const pageCache = new Map<string, { html: string; finalPath: string } | null>()

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

export function isHobbydbImageUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'images.hobbydb.com'
  } catch {
    return false
  }
}

export function upgradePriceChartingImageUrl(url: string): string {
  return url.replace(/\/60\.jpg(\?.*)?$/i, '/240.jpg')
}

export function parsePriceChartingProductImage(html: string): string | null {
  const hashRe = new RegExp(
    `https://${PC_IMAGE_HOST.replace(/\./g, '\\.')}/([a-z0-9]+)/240\\.jpg`,
    'i',
  )
  const hash = html.match(hashRe)
  if (hash) return hash[0]

  const anyRe = new RegExp(
    `https://${PC_IMAGE_HOST.replace(/\./g, '\\.')}/[^"'\\s]+?\\.(?:jpg|jpeg|png|webp)`,
    'gi',
  )
  const matches = html.match(anyRe) ?? []
  const pick =
    matches.find((u) => u.includes('/240.jpg')) ??
    matches.find((u) => u.includes('/1600.jpg')) ??
    matches.find((u) => u.includes('/60.jpg')) ??
    matches[0]
  return pick ? upgradePriceChartingImageUrl(pick.replace(/'$/, '')) : null
}

export function parsePriceChartingProductTitle(html: string): string | null {
  const m = html.match(/<title>([^<|]+)/i)
  if (!m) return null
  return m[1]
    .replace(/\s+#\d+.*$/i, '')
    .replace(/\s+Prices\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleToSlug(title: string): string {
  return norm(title.replace(/\s*#\d+.*$/i, '').replace(/\./g, ' '))
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function pcPrefix(categorySlug: string): string | null {
  return PRICECHARTING_SLUG[categorySlug] ?? null
}

async function fetchPcHtml(path: string): Promise<{ html: string; finalPath: string } | null> {
  const key = path
  if (pageCache.has(key)) return pageCache.get(key) ?? null

  let result: { html: string; finalPath: string } | null = null
  try {
    const res = await fetch(`${PC_ORIGIN}${path}`, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      pageCache.set(key, null)
      return null
    }
    result = { html: await res.text(), finalPath: new URL(res.url).pathname }
  } catch {
    result = null
  }
  pageCache.set(key, result)
  return result
}

async function fetchPcGamePage(path: string): Promise<{ html: string; finalPath: string } | null> {
  const page = await fetchPcHtml(path)
  if (!page?.finalPath.startsWith('/game/funko-pop-')) return null
  return page
}

function scoreTitleMatch(candidate: string, queryTitle: string, querySubseries: string): number {
  let score = 0
  const c = norm(candidate)
  const q = norm(queryTitle)
  const sub = norm(querySubseries)
  if (q && c === q) score += 20
  else if (q && c.includes(q)) score += 14
  if (sub && c.includes(sub)) score += 10
  score += tokenOverlap(candidate, queryTitle) * 4
  score += tokenOverlap(candidate, querySubseries) * 3
  return score
}

function titlesCloseEnough(productTitle: string, candidateTitle: string): boolean {
  const np = norm(productTitle)
  const nc = norm(candidateTitle)
  if (np === nc) return true

  const productTokens = np.split(/\s+/).filter((t) => t.length > 2)
  const candTokens = nc.split(/\s+/).filter((t) => t.length > 2)
  const allCandInProduct = candTokens.every((t) => productTokens.includes(t))
  const extraProduct = productTokens.filter((t) => !candTokens.includes(t))
  const extraCand = candTokens.filter((t) => !productTokens.includes(t))

  if (allCandInProduct && extraCand.length === 0 && extraProduct.length === 0) return true
  if (allCandInProduct && extraCand.length === 0 && extraProduct.length > 0 && nc.length >= np.length) {
    return true
  }

  if (tokenOverlap(productTitle, candidateTitle) >= 2) return true

  let fuzzy = 0
  for (const ct of candTokens.filter((t) => t.length > 3)) {
    if (
      productTokens.some(
        (pt) => pt === ct || pt.startsWith(ct.slice(0, 4)) || ct.startsWith(pt.slice(0, 4)),
      )
    ) {
      fuzzy++
    }
  }
  return fuzzy >= 2
}

function popMatchBonus(resultPop: number | null, queryPop: number | null): number {
  if (queryPop == null || resultPop == null) return 0
  return resultPop === queryPop ? 8 : -6
}

function popFromPcSlug(slug: string): number | null {
  const m = slug.match(/-(\d{1,5})$/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function resolvePriceChartingImage(opts: {
  categorySlug: string
  title: string
  popNumber: number | null
  queryTitle?: string
  querySubseries?: string
}): Promise<FunkoImageSuggestion | null> {
  const prefix = pcPrefix(opts.categorySlug)
  if (!prefix || !opts.title.trim()) return null

  const slugBase = titleToSlug(opts.title)
  if (!slugBase) return null

  const paths = new Set<string>()
  if (opts.popNumber != null) paths.add(`/game/funko-pop-${prefix}/${slugBase}-${opts.popNumber}`)
  paths.add(`/game/funko-pop-${prefix}/${slugBase}`)

  for (const path of paths) {
    const page = await fetchPcGamePage(path)
    if (!page) continue

    const imageUrl = parsePriceChartingProductImage(page.html)
    if (!imageUrl) continue

    const productTitle = parsePriceChartingProductTitle(page.html) ?? opts.title
    if (!titlesCloseEnough(productTitle, opts.title)) continue

    const slug = page.finalPath.split('/').pop() ?? slugBase
    const matchScore = scoreTitleMatch(
      productTitle,
      opts.queryTitle ?? opts.title,
      opts.querySubseries ?? '',
    )

    return finalizePcSuggestion(
      {
        handle: `pc:${slug}`,
        title: opts.title,
        imageUrl,
        score: 20 + matchScore + popMatchBonus(popFromPcSlug(slug), opts.popNumber),
        popNumber: popFromPcSlug(slug) ?? opts.popNumber,
      },
      opts.popNumber,
    )
  }

  const searchQueries = [
    ['funko', prefix.replace(/-/g, ' '), opts.title, opts.popNumber ?? ''].filter(Boolean).join(' '),
    ['funko', prefix.replace(/-/g, ' '), opts.title].join(' '),
  ]

  for (const query of searchQueries) {
    const q = encodeURIComponent(query)
    const searchPath = `/search-products?type=prices&q=${q}`
    const searchPage = await fetchPcHtml(searchPath)
    if (!searchPage) continue

    if (searchPage.finalPath.startsWith('/game/funko-pop-')) {
      const imageUrl = parsePriceChartingProductImage(searchPage.html)
      const productTitle = parsePriceChartingProductTitle(searchPage.html) ?? opts.title
      if (imageUrl && titlesCloseEnough(productTitle, opts.title)) {
        const slug = searchPage.finalPath.split('/').pop() ?? slugBase
        const matchScore = scoreTitleMatch(
          productTitle,
          opts.queryTitle ?? opts.title,
          opts.querySubseries ?? '',
        )
        return finalizePcSuggestion(
          {
            handle: `pc:${slug}`,
            title: opts.title,
            imageUrl,
            score: 18 + matchScore + popMatchBonus(popFromPcSlug(slug), opts.popNumber),
            popNumber: popFromPcSlug(slug) ?? opts.popNumber,
          },
          opts.popNumber,
        )
      }
    }

    const linkRe = new RegExp(
      `href="https://www\\.pricecharting\\.com(/game/funko-pop-${prefix.replace(/-/g, '\\-')}/([^"]+))"`,
      'gi',
    )
    let best: FunkoImageSuggestion | null = null
    let m: RegExpExecArray | null
    while ((m = linkRe.exec(searchPage.html)) !== null) {
      const productPath = m[1]
      const productSlug = decodeURIComponent(m[2])
      const page = await fetchPcGamePage(productPath)
      if (!page) continue
      const imageUrl = parsePriceChartingProductImage(page.html)
      if (!imageUrl) continue
      const productTitle = parsePriceChartingProductTitle(page.html) ?? opts.title
      if (!titlesCloseEnough(productTitle, opts.title)) continue
      const matchScore = scoreTitleMatch(
        productTitle,
        opts.queryTitle ?? opts.title,
        opts.querySubseries ?? '',
      )
      if (matchScore < 2) continue
      const itemPop = popFromPcSlug(productSlug) ?? opts.popNumber
      const item: FunkoImageSuggestion = {
        handle: `pc:${productSlug}`,
        title: opts.title,
        imageUrl,
        score: 16 + matchScore + popMatchBonus(itemPop, opts.popNumber),
        popNumber: itemPop,
      }
      if (!best || item.score > best.score) best = item
    }

    if (best) return finalizePcSuggestion(best, opts.popNumber)
  }

  return null
}

function finalizePcSuggestion(
  item: FunkoImageSuggestion,
  queryPop: number | null,
): FunkoImageSuggestion | null {
  if (item.score < 10) return null

  const candTokens = norm(item.title).split(/\s+/).filter((t) => t.length > 2)
  if (
    queryPop != null &&
    item.popNumber != null &&
    item.popNumber !== queryPop &&
    candTokens.length <= 1 &&
    Math.abs(item.popNumber - queryPop) > 5
  ) {
    return null
  }

  return item
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const out: R[] = []
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      const val = await fn(items[idx])
      if (val) out.push(val)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return out
}

export async function suggestPriceChartingImages(opts: {
  categorySlug: string
  popNumber: number | null
  title: string
  subseries?: string
  candidateTitles: string[]
  limit?: number
}): Promise<FunkoImageSuggestion[]> {
  const prefix = pcPrefix(opts.categorySlug)
  if (!prefix) return []

  const titles = new Set<string>()
  for (const t of opts.candidateTitles) if (t.trim()) titles.add(t.trim())
  if (!titles.size && opts.title.trim()) titles.add(opts.title.trim())

  const resolved = await mapLimit([...titles], 4, (candidate) =>
    resolvePriceChartingImage({
      categorySlug: opts.categorySlug,
      title: candidate,
      popNumber: opts.popNumber,
      queryTitle: opts.title,
      querySubseries: opts.subseries ?? '',
    }),
  )

  const seen = new Set<string>()
  const ranked: FunkoImageSuggestion[] = []
  for (const item of resolved) {
    const key = `${norm(item.title)}::${item.imageUrl}`
    if (seen.has(key)) continue
    seen.add(key)
    ranked.push(item)
  }

  ranked.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  return ranked.slice(0, opts.limit ?? 24)
}

/** Сброс кэша между запросами API (в dev hot reload). */
export function clearPriceChartingPageCache(): void {
  pageCache.clear()
}
