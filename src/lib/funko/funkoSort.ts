export type FunkoSort = 'pop' | 'pop-desc' | 'name' | 'name-desc' | 'manual'

export const DEFAULT_FUNKO_SORT: FunkoSort = 'pop'

export const FUNKO_SORT_OPTIONS: { value: FunkoSort; label: string }[] = [
  { value: 'pop', label: '№ Pop ↑' },
  { value: 'pop-desc', label: '№ Pop ↓' },
  { value: 'name', label: 'Название А–Я' },
  { value: 'name-desc', label: 'Название Я–А' },
  { value: 'manual', label: 'Порядок PDF' },
]

export function parseFunkoSort(raw: string | null | undefined): FunkoSort {
  if (raw && FUNKO_SORT_OPTIONS.some((o) => o.value === raw)) {
    return raw as FunkoSort
  }
  return DEFAULT_FUNKO_SORT
}

export function funkoSortSql(sort: FunkoSort): string {
  switch (sort) {
    case 'pop-desc':
      return 'i.pop_number DESC NULLS LAST, i.title ASC'
    case 'name':
      return 'i.title ASC, i.pop_number ASC NULLS LAST'
    case 'name-desc':
      return 'i.title DESC, i.pop_number ASC NULLS LAST'
    case 'manual':
      return 'i.sort_order ASC, i.title ASC'
    case 'pop':
    default:
      return 'i.pop_number ASC NULLS LAST, i.title ASC'
  }
}
