import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { parseFunkoSort } from '@/lib/funko/funkoSort'
import {
  createFunkoItem,
  DEFAULT_PAGE_SIZE,
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
  const search = searchParams.get('search') ?? searchParams.get('q') ?? undefined
  const filter = searchParams.get('filter') ?? ''
  const owned = filter === 'owned' || searchParams.get('owned') === '1'
  const inTransit =
    filter === 'inTransit' || searchParams.get('inTransit') === '1' || searchParams.get('want') === '1'
  const sort = parseFunkoSort(searchParams.get('sort'))
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get('pageSize') ?? DEFAULT_PAGE_SIZE)),
  )

  try {
    const [categories, list, stats] = await Promise.all([
      listFunkoCategories(),
      listFunkoItems({
        categorySlug,
        search,
        owned: owned || undefined,
        inTransit: inTransit || undefined,
        sort,
        page,
        pageSize,
      }),
      getFunkoStats(categorySlug),
    ])

    return NextResponse.json({
      categories,
      items: list.items,
      pagination: {
        total: list.total,
        page: list.page,
        pageSize: list.pageSize,
        totalPages: list.totalPages,
      },
      stats,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[funko] GET:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const body = await req.json()
  const title = String(body.title ?? '').trim()
  if (!title) {
    return NextResponse.json({ error: 'Укажите название' }, { status: 400 })
  }

  try {
    const item = await createFunkoItem({
      categorySlug: String(body.categorySlug ?? 'animation'),
      title,
      popNumber: typeof body.popNumber === 'number' ? body.popNumber : null,
      subseries: typeof body.subseries === 'string' ? body.subseries : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
      owned: Boolean(body.owned),
      inTransit: Boolean(body.inTransit),
      hasDuplicates: Boolean(body.hasDuplicates),
      quantity: typeof body.quantity === 'number' ? body.quantity : 0,
    })
    if (!item) {
      return NextResponse.json({ error: 'Не удалось создать' }, { status: 500 })
    }
    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
