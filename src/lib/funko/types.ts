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
  imageGcsKey: string | null
  series: string[]
  popNumber: number | null
  owned: boolean
  inTransit: boolean
  hasDuplicates: boolean
  quantity: number
  notes: string | null
  sortOrder: number
}

export interface FunkoTitleSuggestion {
  title: string
  popNumber: number | null
  score: number
}

export interface FunkoImageSuggestion {
  handle: string
  title: string
  imageUrl: string
  score: number
  popNumber: number | null
}

export interface FunkoListResult {
  items: FunkoItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
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
