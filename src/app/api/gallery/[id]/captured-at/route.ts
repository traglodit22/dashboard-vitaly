import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { setGalleryCapturedAt } from '@/lib/gallery/galleryService'

export const runtime = 'nodejs'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  const body = await req.json()

  if (body.capturedAt === undefined) {
    return NextResponse.json({ error: 'Укажите capturedAt' }, { status: 400 })
  }

  try {
    const item = await setGalleryCapturedAt(id, String(body.capturedAt ?? ''))
    return NextResponse.json({ item })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message.includes('не найден') ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
