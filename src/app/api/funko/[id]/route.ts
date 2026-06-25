import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { deleteFunkoItem, patchFunkoItem } from '@/lib/funko/funkoService'

export const runtime = 'nodejs'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  const body = await req.json()

  try {
    const item = await patchFunkoItem(id, {
      owned: typeof body.owned === 'boolean' ? body.owned : undefined,
      want: typeof body.want === 'boolean' ? body.want : undefined,
      quantity: typeof body.quantity === 'number' ? body.quantity : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
      title: typeof body.title === 'string' ? body.title : undefined,
    })

    if (!item) {
      return NextResponse.json({ error: 'Фигурка не найдена' }, { status: 404 })
    }

    return NextResponse.json({ item })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  const ok = await deleteFunkoItem(id)
  if (!ok) {
    return NextResponse.json({ error: 'Фигурка не найдена' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
