export interface FunkoCategory {
  id: string
  slug: string
  name: string
  sortOrder: number
}

export interface FunkoItem {
  id: string
  categoryId: string
  categorySlug: string
  categoryName: string
  handle: string
  title: string
  imageUrl: string | null
  series: string[]
  popNumber: number | null
  owned: boolean
  inTransit: boolean
  hasDuplicates: boolean
  quantity: number
  notes: string | null
  sortOrder: number
}

export interface FunkoCatalogStats {
  total: number
  owned: number
  inTransit: number
}

export interface FunkoImportRow {
  handle: string
  title: string
  imageUrl: string
  series: string[]
}
