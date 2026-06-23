import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { refreshOtherShipmentStatuses } from '@/lib/delivery/refreshShipmentStatuses'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  try {
    const { checked, changed } = await refreshOtherShipmentStatuses()
    return NextResponse.json({ checked, changed })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }
}
