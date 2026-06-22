import type { ProcurementItem } from '@/lib/procurement/mapRow'

export type RowHighlight = 'red' | 'yellow' | 'green'

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
  red: 'bg-red-500/10 border-l-4 border-l-red-500',
  yellow: 'bg-amber-400/12 border-l-4 border-l-amber-500',
  green: 'bg-emerald-500/10 border-l-4 border-l-emerald-500',
}

export const ROW_HIGHLIGHT_LABEL: Record<RowHighlight, string> = {
  red: 'Нет на складе и в пути',
  yellow: 'Частично закрыто',
  green: 'Закрыто',
}
