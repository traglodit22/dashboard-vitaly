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
  const withProto = html.match(
    new RegExp(`https://${PC_IMAGE_HOST.replace(/\./g, '\\.')}/[^"'\\s]+?\\.(?:jpg|jpeg|png|webp)`, 'i'),
  )
  if (withProto) return upgradePriceChartingImageUrl(withProto[0].replace(/'$/, ''))

  const bare = html.match(
    new RegExp(`${PC_IMAGE_HOST.replace(/\./g, '\\.')}/[^"'\\s]+?\\.(?:jpg|jpeg|png|webp)`, 'i'),
  )
  if (bare) return upgradePriceChartingImageUrl(`https://${bare[0].replace(/'$/, '')}`)

  return null
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
  return norm(title.replace(/\s*#\d+.*$/i, '').replace(/[()]/g, ' ').replace(/\./g, ' '))
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function slugToTitle(slug: string): string {
  const base = slug.replace(/-\d{1,5}$/, '')
  return base
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function pcPrefix(categorySlug: string): string | null {
  return PRICECHARTING_SLUG[categorySlug] ?? null
}

function popFromPcSlug(slug: string): number | null {
  const m = slug.match(/-(\d{1,5})$/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

async function fetchPcHtml(path: string, retries = 1): Promise<{ html: string; finalPath: string } | null> {
  const key = path
  if (pageCache.has(key)) return pageCache.get(key) ?? null

  let result: { html: string; finalPath: string } | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${PC_ORIGIN}${path}`, {
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) continue
      result = { html: await res.text(), finalPath: new URL(res.url).pathname }
      break
    } catch {
      /* retry */
    }
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
  return resultPop === queryPop ? 8 : -4
}

function finalizePcSuggestion(
  item: FunkoImageSuggestion,
  queryPop: number | null,
): FunkoImageSuggestion | null {
  if (item.score < 8) return null

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

function pickDisplayTitle(slug: string, candidateTitles: string[]): string {
  const slugTitle = slugToTitle(slug)
  let best = slugTitle
  let bestScore = 0
  for (const c of candidateTitles) {
    const s = scoreTitleMatch(c, slugTitle, '') + tokenOverlap(c, slugTitle) * 3
    if (s > bestScore) {
      bestScore = s
      best = c
    }
  }
  return best
}

/** Быстрый разбор результатов поиска PriceCharting (без захода на каждую карточку). */
export function parsePriceChartingSearchResults(
  html: string,
  prefix: string,
  opts: {
    popNumber: number | null
    queryTitle: string
    querySubseries: string
    candidateTitles: string[]
  },
): FunkoImageSuggestion[] {
  const prefixEsc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const out: FunkoImageSuggestion[] = []
  const seen = new Set<string>()

  for (const block of html.split(/<tr[\s>]/i)) {
    if (!block.includes(`funko-pop-${prefix}`)) continue

    const slugM = block.match(new RegExp(`funko-pop-${prefixEsc}/([a-z0-9%'-]+)`, 'i'))
    if (!slugM) continue
    const slug = decodeURIComponent(slugM[1].replace(/%27/gi, "'"))
    if (seen.has(slug)) continue

    const imgM = block.match(
      /https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[^"'\s]+/i,
    )
    if (!imgM) continue

    const pop = popFromPcSlug(slug)
    if (opts.popNumber != null && pop != null && pop !== opts.popNumber) continue

    const displayTitle = pickDisplayTitle(slug, [
      ...opts.candidateTitles,
      opts.queryTitle,
      slugToTitle(slug),
    ])
    const matchScore = scoreTitleMatch(displayTitle, opts.queryTitle, opts.querySubseries)
    if (matchScore < 2 && opts.queryTitle) continue

    seen.add(slug)
    out.push({
      handle: `pc:${slug}`,
      title: displayTitle,
      imageUrl: upgradePriceChartingImageUrl(imgM[0].replace(/'$/, '')),
      score: 22 + matchScore + popMatchBonus(pop, opts.popNumber),
      popNumber: pop ?? opts.popNumber,
    })
  }

  return out
}

function slugMatchesTitle(slug: string, title: string): boolean {
  const slugNorm = norm(slug.replace(/-\d+$/, ''))
  const tokens = norm(title)
    .split(/\s+/)
    .filter((t) => t.length >= 4)
  if (!tokens.length) return true
  return tokens.some((t) => slugNorm.includes(t.slice(0, Math.min(t.length, 5))))
}

function buildSearchQueries(opts: {
  prefix: string
  popNumber: number | null
  title: string
  subseries?: string
}): string[] {
  const cat = opts.prefix.replace(/-/g, ' ')
  const title = opts.title.replace(/\s*#\d+.*$/i, '').trim()
  const sub = (opts.subseries ?? '').trim()
  const queries = new Set<string>()
  if (opts.popNumber != null && title) {
    queries.add(`funko ${cat} ${opts.popNumber} ${title}`)
    queries.add(`funko ${cat} ${title} ${opts.popNumber}`)
  }
  if (opts.popNumber != null) queries.add(`funko ${cat} ${opts.popNumber}`)
  if (title) queries.add(`funko ${cat} ${title}`)
  if (sub && opts.popNumber != null) queries.add(`funko ${cat} ${opts.popNumber} ${sub}`)
  return [...queries].slice(0, 3)
}

function suggestionFromGamePage(
  page: { html: string; finalPath: string },
  opts: {
    title: string
    popNumber: number | null
    queryTitle: string
    querySubseries: string
  },
): FunkoImageSuggestion | null {
  const imageUrl = parsePriceChartingProductImage(page.html)
  if (!imageUrl) return null

  const productTitle = parsePriceChartingProductTitle(page.html) ?? opts.title
  if (!titlesCloseEnough(productTitle, opts.title)) return null

  const slug = page.finalPath.split('/').pop() ?? titleToSlug(opts.title)
  const matchScore = scoreTitleMatch(productTitle, opts.queryTitle, opts.querySubseries)

  return finalizePcSuggestion(
    {
      handle: `pc:${slug}`,
      title: opts.title,
      imageUrl,
      score: 24 + matchScore + popMatchBonus(popFromPcSlug(slug), opts.popNumber),
      popNumber: popFromPcSlug(slug) ?? opts.popNumber,
    },
    opts.popNumber,
  )
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

  const paths: string[] = []
  if (opts.popNumber != null) paths.push(`/game/funko-pop-${prefix}/${slugBase}-${opts.popNumber}`)
  paths.push(`/game/funko-pop-${prefix}/${slugBase}`)

  for (const path of paths) {
    const page = await fetchPcGamePage(path)
    if (!page) continue
    const hit = suggestionFromGamePage(page, {
      title: opts.title,
      popNumber: opts.popNumber,
      queryTitle: opts.queryTitle ?? opts.title,
      querySubseries: opts.querySubseries ?? '',
    })
    if (hit) return hit
  }

  return null
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

  const limit = opts.limit ?? 24
  const candidateTitles = [...new Set(opts.candidateTitles.map((t) => t.trim()).filter(Boolean))].slice(
    0,
    8,
  )
  const parseOpts = {
    popNumber: opts.popNumber,
    queryTitle: opts.title,
    querySubseries: opts.subseries ?? '',
    candidateTitles,
  }

  const byKey = new Map<string, FunkoImageSuggestion>()

  function add(item: FunkoImageSuggestion | null) {
    if (!item) return
    const finalized = finalizePcSuggestion(item, opts.popNumber)
    if (!finalized) return
    const key = `${norm(finalized.title)}::${finalized.imageUrl}`
    const prev = byKey.get(key)
    if (!prev || finalized.score > prev.score) byKey.set(key, finalized)
  }

  for (const query of buildSearchQueries({ prefix, ...opts })) {
    if (byKey.size >= limit) break
    const searchPath = `/search-products?type=prices&q=${encodeURIComponent(query)}`
    const page = await fetchPcHtml(searchPath)
    if (!page) continue

    if (page.finalPath.startsWith('/game/funko-pop-')) {
      add(
        suggestionFromGamePage(page, {
          title: opts.title,
          popNumber: opts.popNumber,
          queryTitle: opts.title,
          querySubseries: opts.subseries ?? '',
        }),
      )
    } else {
      for (const item of parsePriceChartingSearchResults(page.html, prefix, parseOpts)) {
        add(item)
      }
    }
  }

  const cat = prefix.replace(/-/g, ' ')
  const extraTitles = candidateTitles
    .filter((t) => norm(t) !== norm(opts.title))
    .slice(0, 3)
  if (byKey.size < limit && extraTitles.length) {
    await Promise.all(
      extraTitles.map(async (title) => {
        if (byKey.size >= limit) return
        const page = await fetchPcHtml(
          `/search-products?type=prices&q=${encodeURIComponent(`funko ${cat} ${title}`)}`,
        )
        if (!page) return
        if (page.finalPath.startsWith('/game/funko-pop-')) {
          const slug = page.finalPath.split('/').pop() ?? ''
          if (!slugMatchesTitle(slug, title)) return
          add(
            suggestionFromGamePage(page, {
              title,
              popNumber: opts.popNumber,
              queryTitle: opts.title,
              querySubseries: opts.subseries ?? '',
            }),
          )
          return
        }
        for (const item of parsePriceChartingSearchResults(page.html, prefix, {
          ...parseOpts,
          popNumber: null,
        })) {
          const slug = item.handle.replace(/^pc:/, '')
          if (!slugMatchesTitle(slug, title)) continue
          const merged = { ...item, title }
          if (!titlesCloseEnough(merged.title, title) && scoreTitleMatch(merged.title, title, '') < 10) {
            continue
          }
          add(merged)
        }
      }),
    )
  }

  if (byKey.size < limit && opts.popNumber != null) {
    const relaxed = { ...parseOpts, popNumber: null }
    for (const query of buildSearchQueries({ prefix, ...opts }).slice(0, 2)) {
      if (byKey.size >= limit) break
      const page = await fetchPcHtml(`/search-products?type=prices&q=${encodeURIComponent(query)}`)
      if (!page || page.finalPath.startsWith('/game/funko-pop-')) continue
      for (const item of parsePriceChartingSearchResults(page.html, prefix, relaxed)) {
        add(item)
      }
    }
  }

  if (byKey.size < limit) {
    const fallbacks = [opts.title, ...candidateTitles].filter(Boolean).slice(0, 3)
    await Promise.all(
      fallbacks.map(async (title) => {
        if (byKey.size >= limit) return
        add(
          await resolvePriceChartingImage({
            categorySlug: opts.categorySlug,
            title,
            popNumber: opts.popNumber,
            queryTitle: opts.title,
            querySubseries: opts.subseries ?? '',
          }),
        )
      }),
    )
  }

  const byTitle = new Map<string, FunkoImageSuggestion>()
  for (const item of byKey.values()) {
    const key = norm(item.title)
    const prev = byTitle.get(key)
    if (!prev || item.score > prev.score) byTitle.set(key, item)
  }

  return [...byTitle.values()]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
}

export function clearPriceChartingPageCache(): void {
  pageCache.clear()
}
