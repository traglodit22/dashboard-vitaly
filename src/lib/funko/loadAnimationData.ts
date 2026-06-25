import { loadCategoryImportRows, parseFunkoCsv } from '@/lib/funko/loadCategoryData'
import type { FunkoImportRow } from '@/lib/funko/types'

/** @deprecated Используйте loadCategoryImportRows('animation') */
export { parseFunkoCsv }

export async function loadAnimationImportRows(
  source: 'bundled' | 'download' = 'bundled',
): Promise<FunkoImportRow[]> {
  return loadCategoryImportRows('animation', source)
}
