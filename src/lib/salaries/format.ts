const MONTHS_RU = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]

// "2026-05" → "Май 2026"
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const name = MONTHS_RU[(m ?? 1) - 1] ?? ''
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`
}

// Сдвиг месяца на delta (±1) с переходом через год. "2026-01" - 1 → "2025-12".
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${mm}`
}

// Текущий месяц "YYYY-MM".
export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatHours(n: number): string {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}
