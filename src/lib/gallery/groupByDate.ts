import type { FileItem } from '@/lib/files/types'

export interface GalleryDayGroup {
  year: number
  month: number
  day: number
  label: string
  items: FileItem[]
}

export interface GalleryMonthGroup {
  year: number
  month: number
  label: string
  items: FileItem[]
  days: GalleryDayGroup[]
}

export interface GalleryYearGroup {
  year: number
  months: GalleryMonthGroup[]
  total: number
}

export const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

export const MONTH_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]

export function galleryMonthAnchor(year: number, month: number): string {
  return `gallery-${year}-${month}`
}

export function galleryDayAnchor(year: number, month: number, day: number): string {
  return `gallery-${year}-${month}-${day}`
}

export function parseGalleryHash(hash: string): { year: number; month: number; day?: number } | null {
  const raw = hash.replace(/^#/, '')
  const m = raw.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = m[3] ? Number(m[3]) : undefined
  if (!year || month < 1 || month > 12) return null
  if (day != null && (day < 1 || day > 31)) return null
  return { year, month, day }
}

export function galleryHash(year: number, month: number, day?: number): string {
  const mm = String(month).padStart(2, '0')
  if (day == null) return `#${year}-${mm}`
  return `#${year}-${mm}-${String(day).padStart(2, '0')}`
}

function itemSortDate(item: FileItem): number {
  const raw = item.capturedAt || item.createdAt
  return new Date(raw).getTime()
}

function itemYmd(item: FileItem): { year: number; month: number; day: number } {
  const d = new Date(item.capturedAt || item.createdAt)
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
}

export function groupItemsByDay(items: FileItem[]): GalleryDayGroup[] {
  const byDay = new Map<string, FileItem[]>()
  for (const item of items) {
    const { year, month, day } = itemYmd(item)
    const key = `${year}-${month}-${day}`
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(item)
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, dayItems]) => {
      const [y, m, d] = key.split('-').map(Number)
      return {
        year: y,
        month: m,
        day: d,
        label: `${d} ${MONTH_SHORT[m - 1]}`,
        items: dayItems.sort((a, b) => itemSortDate(b) - itemSortDate(a)),
      }
    })
}

export function groupGalleryByYearMonth(items: FileItem[]): GalleryYearGroup[] {
  const sorted = [...items].sort((a, b) => itemSortDate(b) - itemSortDate(a))
  const byYear = new Map<number, Map<number, FileItem[]>>()

  for (const item of sorted) {
    const { year, month } = itemYmd(item)
    if (!byYear.has(year)) byYear.set(year, new Map())
    const months = byYear.get(year)!
    if (!months.has(month)) months.set(month, [])
    months.get(month)!.push(item)
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, monthsMap]) => {
      const months = [...monthsMap.entries()]
        .sort(([a], [b]) => b - a)
        .map(([month, monthItems]) => ({
          year,
          month,
          label: `${MONTH_NAMES[month - 1]} ${year}`,
          items: monthItems,
          days: groupItemsByDay(monthItems),
        }))
      return {
        year,
        months,
        total: months.reduce((n, m) => n + m.items.length, 0),
      }
    })
}

/** Дни месяца с фото: day → count */
export function photoDaysInMonth(items: FileItem[], year: number, month: number): Map<number, number> {
  const out = new Map<number, number>()
  for (const item of items) {
    const ymd = itemYmd(item)
    if (ymd.year !== year || ymd.month !== month) continue
    out.set(ymd.day, (out.get(ymd.day) ?? 0) + 1)
  }
  return out
}

export function scrollToGalleryAnchor(
  year: number,
  month: number,
  day?: number,
  behavior: ScrollBehavior = 'smooth',
): void {
  const id = day != null ? galleryDayAnchor(year, month, day) : galleryMonthAnchor(year, month)
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior, block: 'start' })
  if (typeof window !== 'undefined') {
    const next = galleryHash(year, month, day)
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', `${window.location.pathname}${next}`)
    }
  }
}
