import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import {
  getFunkoStats,
  listFunkoCategories,
  listFunkoItems,
} from '@/lib/funko/funkoService'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { searchParams } = new URL(req.url)
  const categorySlug = searchParams.get('category') ?? undefined
  const search = searchParams.get('search') ?? undefined
  const owned = searchParams.get('owned') === '1'
  const inTransit = searchParams.get('inTransit') === '1' || searchParams.get('want') === '1'

  try {
    const [categories, items, stats] = await Promise.all([
      listFunkoCategories(),
      listFunkoItems({
        categorySlug,
        search,
        owned: owned || undefined,
        inTransit: inTransit || undefined,
      }),
      getFunkoStats(categorySlug),
    ])

    return NextResponse.json({ categories, items, stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[funko] GET:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
