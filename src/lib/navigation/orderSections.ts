import type { NavSection } from '@/components/navigation'

/** Порядок вкладок по умолчанию (ключи из navigation.ts). */
export const DEFAULT_NAV_SECTION_ORDER = [
  'overview',
  'files',
  'gallery',
  'funko',
  'china',
  'smmlaba',
] as const

export type NavSectionKey = (typeof DEFAULT_NAV_SECTION_ORDER)[number]

export function orderNavSections(
  sections: NavSection[],
  order: string[] | null | undefined,
): NavSection[] {
  if (!order?.length) return sections

  const map = new Map(sections.map((s) => [s.key, s]))
  const result: NavSection[] = []

  for (const key of order) {
    const section = map.get(key)
    if (section) {
      result.push(section)
      map.delete(key)
    }
  }

  for (const section of sections) {
    if (map.has(section.key)) result.push(section)
  }

  return result
}

export function sanitizeNavSectionOrder(
  order: unknown,
  validKeys: Set<string>,
): string[] | null {
  if (!Array.isArray(order)) return null
  const seen = new Set<string>()
  const out: string[] = []
  for (const key of order) {
    if (typeof key !== 'string') continue
    const k = key.trim()
    if (!k || !validKeys.has(k) || seen.has(k)) continue
    seen.add(k)
    out.push(k)
  }
  return out.length ? out : null
}
