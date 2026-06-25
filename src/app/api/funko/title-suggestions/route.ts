import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getCategoryDef } from '@/lib/funko/categoryConfig'
import { suggestCatalogTitles } from '@/lib/funko/catalogSuggestions'

export const runtime = 'nodejs'

function parsePop(raw: string | null): number | null {
  if (!raw?.trim()) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { searchParams } = new URL(req.url)
  const categorySlug = searchParams.get('categorySlug')?.trim() ?? ''
  if (!categorySlug || !getCategoryDef(categorySlug)) {
    return NextResponse.json({ error: 'Укажите категорию' }, { status: 400 })
  }

  const popNumber = parsePop(searchParams.get('popNumber'))
  if (popNumber == null) {
    return NextResponse.json(
      { error: 'Укажите № Pop для подбора названия' },
      { status: 400 },
    )
  }

  const suggestions = await suggestCatalogTitles({
    categorySlug,
    popNumber,
    title: searchParams.get('title') ?? undefined,
    subseries: searchParams.get('subseries') ?? undefined,
    categorySeries: getCategoryDef(categorySlug)?.name,
    limit: 12,
  })

  return NextResponse.json({ suggestions })
}
