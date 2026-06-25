import type { FunkoCategory } from '@/lib/funko/types'

export function orderFunkoCategories(
  categories: FunkoCategory[],
  order: string[] | null | undefined,
): FunkoCategory[] {
  if (!order?.length) return categories

  const map = new Map(categories.map((c) => [c.slug, c]))
  const result: FunkoCategory[] = []

  for (const slug of order) {
    const cat = map.get(slug)
    if (cat) {
      result.push(cat)
      map.delete(slug)
    }
  }

  for (const cat of categories) {
    if (map.has(cat.slug)) result.push(cat)
  }

  return result
}

export function sanitizeFunkoCategoryOrder(
  order: unknown,
  validSlugs: Set<string>,
): string[] | null {
  if (!Array.isArray(order)) return null
  const seen = new Set<string>()
  const out: string[] = []
  for (const slug of order) {
    if (typeof slug !== 'string') continue
    const s = slug.trim()
    if (!s || !validSlugs.has(s) || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out.length ? out : null
}
