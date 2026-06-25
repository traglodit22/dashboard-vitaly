import { query } from '@/lib/db/index'
import { SECTIONS } from '@/components/navigation'
import {
  DEFAULT_NAV_SECTION_ORDER,
  orderNavSections,
  sanitizeNavSectionOrder,
} from '@/lib/navigation/orderSections'
import type { NavSection } from '@/components/navigation'

const VALID_KEYS = new Set(SECTIONS.map((s) => s.key))

export async function getNavSectionOrderKeys(): Promise<string[]> {
  try {
    const rows = await query<{ nav_section_order: string[] | null }>(
      'SELECT nav_section_order FROM system_settings WHERE id = 1',
    )
    const saved = sanitizeNavSectionOrder(rows[0]?.nav_section_order, VALID_KEYS)
    if (saved?.length) return saved
  } catch (err) {
    console.error('[nav] read order failed:', err)
  }
  return [...DEFAULT_NAV_SECTION_ORDER]
}

export async function getOrderedNavSections(): Promise<NavSection[]> {
  const order = await getNavSectionOrderKeys()
  return orderNavSections(SECTIONS, order)
}

export async function saveNavSectionOrder(order: unknown): Promise<string[]> {
  const sanitized =
    sanitizeNavSectionOrder(order, VALID_KEYS) ?? [...DEFAULT_NAV_SECTION_ORDER]

  // Добавить новые разделы, которых не было в сохранённом порядке
  const complete: string[] = [...sanitized]
  for (const section of SECTIONS) {
    if (!complete.includes(section.key)) complete.push(section.key)
  }

  await query(
    'UPDATE system_settings SET nav_section_order = $1, updated_at = NOW() WHERE id = 1',
    [complete],
  )
  return complete
}
