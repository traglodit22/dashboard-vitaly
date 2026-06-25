import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getNavSectionOrderKeys } from '@/lib/navigation/navOrder'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const order = await getNavSectionOrderKeys()
  return NextResponse.json({ order })
}
