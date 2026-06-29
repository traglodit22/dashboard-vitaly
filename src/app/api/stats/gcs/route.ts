import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getGcsBucketStats } from '@/lib/files/gcsBucketStats'
import { isGcsConfigured } from '@/lib/files/gcsStorage'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  if (!isGcsConfigured()) {
    return NextResponse.json({ configured: false })
  }

  const refresh = new URL(req.url).searchParams.get('refresh') === '1'

  try {
    const stats = await getGcsBucketStats(refresh)
    if (!stats) {
      return NextResponse.json({ configured: false })
    }
    return NextResponse.json({ configured: true, stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось получить статистику GCS'
    console.error('[stats/gcs]', err)
    return NextResponse.json({ configured: true, error: message }, { status: 502 })
  }
}
