import type { StatusColorKey } from '@/lib/procurement/statusColors'
import { parseStatusColorKey } from '@/lib/procurement/statusColors'

export type ProcurementRowType = 'item' | 'type'

export interface ProcurementCategory {
  id: string
  name: string
  sortOrder: number
}

export interface ProcurementStatus {
  id: string
  categoryId: string
  name: string
  colorKey: StatusColorKey
  sortOrder: number
}

export interface ProcurementItemStatus {
  id: string
  name: string
  colorKey: StatusColorKey
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
  linkLabel: string | null
  imageMime: string | null
  imageUpdatedAt: string | null
  sortOrder: number
  rowType: ProcurementRowType
  statusId: string | null
  status: ProcurementItemStatus | null
}

export function rowToCategory(row: Record<string, unknown>): ProcurementCategory {
  return {
    id: row.id as string,
    name: row.name as string,
    sortOrder: Number(row.sort_order ?? 0),
  }
}

export function rowToStatus(row: Record<string, unknown>): ProcurementStatus {
  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    name: row.name as string,
    colorKey: parseStatusColorKey(row.color_key),
    sortOrder: Number(row.sort_order ?? 0),
  }
}

export function rowToItem(row: Record<string, unknown>): ProcurementItem {
  const need = Number(row.need_qty ?? 0)
  const have = Number(row.have_qty ?? 0)
  const transit = Number(row.in_transit_qty ?? 0)
  const joinedStatusId = row.joined_status_id as string | undefined

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
    linkLabel: (row.link_label as string) ?? null,
    imageMime: (row.image_mime as string) ?? null,
    imageUpdatedAt: (row.image_updated_at as string) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    rowType: parseRowType(row.row_type),
    statusId: (row.status_id as string) ?? null,
    status: joinedStatusId
      ? {
          id: joinedStatusId,
          name: row.joined_status_name as string,
          colorKey: parseStatusColorKey(row.joined_status_color_key),
        }
      : null,
  }
}

function parseRowType(value: unknown): ProcurementRowType {
  return value === 'type' ? 'type' : 'item'
}

export const ITEM_SELECT_SQL = `
  i.*,
  c.name AS category_name,
  s.id AS joined_status_id,
  s.name AS joined_status_name,
  s.color_key AS joined_status_color_key
`

export const ITEM_FROM_SQL = `
  FROM procurement_items i
  JOIN procurement_categories c ON c.id = i.category_id
  LEFT JOIN procurement_statuses s ON s.id = i.status_id
`
