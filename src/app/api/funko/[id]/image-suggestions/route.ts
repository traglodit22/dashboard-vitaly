import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { suggestCatalogImages } from '@/lib/funko/catalogSuggestions'
import { getFunkoItemById } from '@/lib/funko/funkoService'

export const runtime = 'nodejs'

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

  const subseries = item.series.find((s) => s !== 'Pop! Animation') ?? ''
  const suggestions = await suggestCatalogImages({
    popNumber: item.popNumber,
    title: item.title,
    subseries,
    limit: 12,
  })

  return NextResponse.json({ suggestions })
}
