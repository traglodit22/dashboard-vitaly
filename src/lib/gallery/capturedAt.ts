/** Дата для сортировки и группировки в галерее. */
export function gallerySortDate(item: {
  capturedAt: string | null
  createdAt: string
}): string {
  return item.capturedAt || item.createdAt
}

/** Значение для `<input type="date">` в локальной зоне. */
export function toDateInputValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** `YYYY-MM-DD` или ISO → Date (полдень локально для date-only). */
export function parseCapturedAtInput(value: string): Date | null {
  const raw = value.trim()
  if (!raw) return null
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}
