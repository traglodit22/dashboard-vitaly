import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { isAllowedFunkoImageProxyUrl } from '@/lib/funko/funkoImageProxy'

export const runtime = 'nodejs'

const CACHE = 'public, max-age=86400, stale-while-revalidate=604800'

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { searchParams } = new URL(req.url)
  const sourceUrl = searchParams.get('url')?.trim() ?? ''
  if (!sourceUrl || !isAllowedFunkoImageProxyUrl(sourceUrl)) {
    return NextResponse.json({ error: 'Некорректный URL' }, { status: 400 })
  }

  try {
    const res = await fetch(sourceUrl, {
      headers: {
        Accept: 'image/*',
        'User-Agent': 'Mozilla/5.0 (compatible; DashBoardTrag/1.0)',
        Referer: 'https://www.pricecharting.com/',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 })
    }

    const mime = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim()
    const buffer = Buffer.from(await res.arrayBuffer())
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': CACHE,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Не удалось загрузить изображение' }, { status: 502 })
  }
}
