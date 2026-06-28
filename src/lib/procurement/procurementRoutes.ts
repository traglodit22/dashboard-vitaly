export const ALL_PROCUREMENT_CATEGORY = '__all__'

export function isAllProcurementCategory(id: string | null | undefined): boolean {
  return !id || id === ALL_PROCUREMENT_CATEGORY
}

export function procurementHref(categoryId: string): string {
  const cat = isAllProcurementCategory(categoryId) ? ALL_PROCUREMENT_CATEGORY : categoryId
  return `/procurement?cat=${encodeURIComponent(cat)}`
}

export function parseProcurementCategory(searchParams: URLSearchParams): string {
  const raw = searchParams.get('cat')
  if (!raw || raw === ALL_PROCUREMENT_CATEGORY) return ALL_PROCUREMENT_CATEGORY
  return raw
}
