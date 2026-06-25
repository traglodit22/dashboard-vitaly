import { getGcsReadSignedUrl } from '@/lib/files/gcsStorage'
import type { FunkoItem } from '@/lib/funko/types'
import { rowToItem } from '@/lib/funko/mapRow'

export async function enrichFunkoItem(row: Record<string, unknown>): Promise<FunkoItem> {
  const item = rowToItem(row)
  if (item.imageGcsKey) {
    try {
      item.imageUrl = await getGcsReadSignedUrl(item.imageGcsKey)
    } catch {
      /* keep external url if any */
    }
  }
  return item
}

export async function enrichFunkoItems(rows: Record<string, unknown>[]): Promise<FunkoItem[]> {
  return Promise.all(rows.map(enrichFunkoItem))
}
