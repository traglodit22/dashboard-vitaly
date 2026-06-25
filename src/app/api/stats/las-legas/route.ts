import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import {
  fetchLasLegas,
  fetchLasLegasCalendar,
  fetchLasLegasDay,
  fetchLasLegasOverview,
  fetchLasLegasPeriod,
  fetchLasLegasRange,
  isLasLegasConfigured,
  LasLegasApiError,
  LasLegasNotConfiguredError,
} from '@/lib/laslegas/client'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  if (!isLasLegasConfigured()) {
    return NextResponse.json({ configured: false })
  }

  const url = new URL(req.url)
  const view = url.searchParams.get('view')
  const month = url.searchParams.get('month')
  const date = url.searchParams.get('date')
  const period = url.searchParams.get('period')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  try {
    if (view === 'calendar' && month) {
      const data = await fetchLasLegasCalendar(month)
      return NextResponse.json({ configured: true, ...data })
    }

    if (date) {
      const data = await fetchLasLegasDay(date)
      return NextResponse.json({ configured: true, ...data })
    }

    if (period === 'today' || period === '7d' || period === '30d') {
      const data = await fetchLasLegasPeriod(period)
      return NextResponse.json({ configured: true, ...data })
    }

    if (from && to) {
      const data = await fetchLasLegasRange(from, to)
      return NextResponse.json({ configured: true, ...data })
    }

    if (view === 'overview' || (!view && !period && !date && !from)) {
      const data = await fetchLasLegasOverview()
      return NextResponse.json({ configured: true, ...data })
    }

    const passthrough: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      passthrough[key] = value
    })
    const data = await fetchLasLegas(passthrough)
    return NextResponse.json({ configured: true, ...(data as object) })
  } catch (err) {
    if (err instanceof LasLegasNotConfiguredError) {
      return NextResponse.json({ configured: false })
    }
    if (err instanceof LasLegasApiError) {
      return NextResponse.json(
        { configured: true, error: err.message, status: err.status },
        { status: err.status === 401 || err.status === 403 ? err.status : 502 },
      )
    }
    const message = err instanceof Error ? err.message : 'Las Legas API error'
    return NextResponse.json({ configured: true, error: message }, { status: 502 })
  }
}
