import type { ProductOrder } from '@/types'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function daysSince(iso: string): number {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.floor((Date.now() - t) / MS_PER_DAY)
}

const WAREHOUSE_STATUS_ID = 1

/** Дней без трек-кода по Китаю (ожидает ввода). */
export function daysWithoutChinaTrack(o: ProductOrder): number | null {
  if (o.status !== 'awaiting_track') return null
  return daysSince(o.createdAt)
}

/** Дней в статусе «Ожидается на складе» (посылка ещё не принята складом ДП). */
export function daysAtWarehouse(o: ProductOrder): number | null {
  if (o.status !== 'sent' || o.dpStatusId !== WAREHOUSE_STATUS_ID) return null
  return daysSince(o.updatedAt)
}

/**
 * Подсветка просроченных посылок:
 * — без трек-кода Китая ≥7 / ≥14 / ≥21 дней;
 * — «Ожидается на складе» без движения ≥7 / ≥14 / ≥21 дней.
 */
export function staleShipmentRowClass(o: ProductOrder): string | undefined {
  const days = daysWithoutChinaTrack(o) ?? daysAtWarehouse(o)
  if (days == null || days < 7) return undefined
  if (days >= 21) {
    return 'bg-red-950/55 hover:bg-red-950/65 dark:bg-red-950/50 dark:hover:bg-red-950/60'
  }
  if (days >= 14) {
    return 'bg-red-600/20 hover:bg-red-600/28 dark:bg-red-600/18 dark:hover:bg-red-600/25'
  }
  return 'bg-red-500/10 hover:bg-red-500/16 dark:bg-red-500/12 dark:hover:bg-red-500/18'
}
