import type { ProcurementItem } from '@/lib/procurement/mapRow'

export type RowHighlight = 'red' | 'yellow' | 'green' | 'gray' | 'white'

export const HIGHLIGHT_COLORS = ['red', 'yellow', 'green', 'gray', 'white'] as const satisfies readonly RowHighlight[]

export function autoRowHighlight(
  needQty: number,
  haveQty: number,
  inTransitQty: number,
): RowHighlight | null {
  if (needQty <= 0) return null
  const remaining = needQty - haveQty - inTransitQty
  if (remaining <= 0) return 'green'
  if (haveQty > 0 || inTransitQty > 0) return 'yellow'
  return 'red'
}

export function effectiveRowHighlight(item: ProcurementItem): RowHighlight | null {
  return item.highlightColor ?? autoRowHighlight(item.needQty, item.haveQty, item.inTransitQty)
}

export const ROW_HIGHLIGHT_CLASS: Record<RowHighlight, string> = {
  red: '!bg-red-500/30 border-l-4 border-l-red-600 hover:!bg-red-500/35',
  yellow: '!bg-amber-400/35 border-l-4 border-l-amber-500 hover:!bg-amber-400/40',
  green: '!bg-emerald-500/30 border-l-4 border-l-emerald-600 hover:!bg-emerald-500/35',
  gray: '!bg-neutral-400/35 border-l-4 border-l-neutral-600 hover:!bg-neutral-400/40',
  white:
    '!bg-white border-l-4 border-l-neutral-300 hover:!bg-white dark:!bg-white/20 dark:border-l-neutral-400 dark:hover:!bg-white/25',
}

export const ROW_HIGHLIGHT_LABEL: Partial<Record<RowHighlight, string>> = {
  red: 'Нет на складе и в пути',
  yellow: 'Частично закрыто',
  green: 'Закрыто',
  gray: 'Дима',
}

export function highlightSwatchTitle(color: RowHighlight): string | undefined {
  return ROW_HIGHLIGHT_LABEL[color]
}
