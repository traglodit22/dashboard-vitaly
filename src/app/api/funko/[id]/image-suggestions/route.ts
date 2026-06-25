import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { suggestCatalogImages } from '@/lib/funko/catalogSuggestions'
import { getFunkoItemById } from '@/lib/funko/funkoService'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  const item = await getFunkoItemById(id)
  if (!item) {
    return NextResponse.json({ error: 'Фигурка не найдена' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const popRaw = searchParams.get('popNumber')
  const popParsed = popRaw != null && popRaw !== '' ? Number(popRaw) : NaN
  const popNumber =
    Number.isFinite(popParsed) && popParsed > 0 ? popParsed : item.popNumber
  const subseries =
    searchParams.get('subseries') ??
    item.series.find((s) => s !== item.categoryName) ??
    ''
  const title = searchParams.get('title') ?? item.title

  const seriesLabel = item.categoryName
  const suggestions = await suggestCatalogImages({
    categorySlug: item.categorySlug,
    popNumber,
    title,
    subseries,
    categorySeries: seriesLabel,
    limit: 24,
  })

  return NextResponse.json({ suggestions })
}
