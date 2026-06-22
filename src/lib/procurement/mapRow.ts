export type ProcurementRowType = 'item' | 'type'

export interface ProcurementCategory {
  id: string
  name: string
  sortOrder: number
}

export interface ProcurementItem {
  id: string
  categoryId: string
  categoryName: string
  groupName: string | null
  name: string
  needQty: number
  haveQty: number
  inTransitQty: number
  remaining: number
  notes: string | null
  link: string | null
  sortOrder: number
  rowType: ProcurementRowType
  highlightColor: RowHighlight | null
}

export type RowHighlight = 'red' | 'yellow' | 'green'

export function rowToCategory(row: Record<string, unknown>): ProcurementCategory {
  return {
    id: row.id as string,
    name: row.name as string,
    sortOrder: Number(row.sort_order ?? 0),
  }
}

export function rowToItem(row: Record<string, unknown>): ProcurementItem {
  const need = Number(row.need_qty ?? 0)
  const have = Number(row.have_qty ?? 0)
  const transit = Number(row.in_transit_qty ?? 0)
  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    categoryName: (row.category_name as string) ?? '',
    groupName: (row.group_name as string) ?? null,
    name: row.name as string,
    needQty: need,
    haveQty: have,
    inTransitQty: transit,
    remaining: need - have - transit,
    notes: (row.notes as string) ?? null,
    link: (row.link as string) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    rowType: parseRowType(row.row_type),
    highlightColor: parseHighlight(row.highlight_color),
  }
}

function parseRowType(value: unknown): ProcurementRowType {
  return value === 'type' ? 'type' : 'item'
}

function parseHighlight(value: unknown): RowHighlight | null {
  if (value === 'red' || value === 'yellow' || value === 'green') return value
  return null
}
