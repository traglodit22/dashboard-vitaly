import type { FileItem } from '@/lib/files/types'

export interface GalleryMonthGroup {
  year: number
  month: number
  label: string
  items: FileItem[]
}

export interface GalleryYearGroup {
  year: number
  months: GalleryMonthGroup[]
  total: number
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

function itemSortDate(item: FileItem): number {
  const raw = item.capturedAt || item.createdAt
  return new Date(raw).getTime()
}

export function groupGalleryByYearMonth(items: FileItem[]): GalleryYearGroup[] {
  const sorted = [...items].sort((a, b) => itemSortDate(b) - itemSortDate(a))
  const byYear = new Map<number, Map<number, FileItem[]>>()

  for (const item of sorted) {
    const d = new Date(item.capturedAt || item.createdAt)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
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
        }))
      return {
        year,
        months,
        total: months.reduce((n, m) => n + m.items.length, 0),
      }
    })
}
