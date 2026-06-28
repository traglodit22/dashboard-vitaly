import type { ProcurementItem } from '@/lib/procurement/mapRow'

export type QtyField = 'need' | 'have' | 'transit'

/** Пустое поле при blur не обнуляет — берём сохранённое значение. */
export function parseQtyInput(raw: string, saved: number): number {
  const trimmed = raw.trim()
  if (trimmed === '') return saved
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return saved
  return Math.floor(n)
}

export function qtyPatchForField(
  field: QtyField,
  raw: { need: string; have: string; transit: string },
  item: Pick<ProcurementItem, 'needQty' | 'haveQty' | 'inTransitQty'>,
): Partial<Pick<ProcurementItem, 'needQty' | 'haveQty' | 'inTransitQty'>> {
  const parsed = {
    need: parseQtyInput(raw.need, item.needQty),
    have: parseQtyInput(raw.have, item.haveQty),
    transit: parseQtyInput(raw.transit, item.inTransitQty),
  }

  const patch: Partial<Pick<ProcurementItem, 'needQty' | 'haveQty' | 'inTransitQty'>> = {}
  if (field === 'need' && parsed.need !== item.needQty) patch.needQty = parsed.need
  if (field === 'have' && parsed.have !== item.haveQty) patch.haveQty = parsed.have
  if (field === 'transit' && parsed.transit !== item.inTransitQty) patch.inTransitQty = parsed.transit
  return patch
}

export function normalizedQtyStrings(
  raw: { need: string; have: string; transit: string },
  item: Pick<ProcurementItem, 'needQty' | 'haveQty' | 'inTransitQty'>,
) {
  return {
    need: String(parseQtyInput(raw.need, item.needQty)),
    have: String(parseQtyInput(raw.have, item.haveQty)),
    transit: String(parseQtyInput(raw.transit, item.inTransitQty)),
  }
}
