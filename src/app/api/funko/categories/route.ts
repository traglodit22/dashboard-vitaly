import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getFunkoCategoryOrderKeys, saveFunkoCategoryOrder } from '@/lib/funko/categoryOrder'
import { listFunkoCategories } from '@/lib/funko/funkoService'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const [categories, order] = await Promise.all([
    listFunkoCategories(),
    getFunkoCategoryOrderKeys(),
  ])

  return NextResponse.json({ categories, order })
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const body = await req.json().catch(() => ({}))
  if (!Array.isArray(body.order)) {
    return NextResponse.json({ error: 'order должен быть массивом slug' }, { status: 400 })
  }

  try {
    const order = await saveFunkoCategoryOrder(body.order)
    const categories = await listFunkoCategories()
    return NextResponse.json({ ok: true, order, categories })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
