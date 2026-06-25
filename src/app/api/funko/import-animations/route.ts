import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { importFunkoRows } from '@/lib/funko/funkoService'
import { loadAnimationImportRows } from '@/lib/funko/loadAnimationData'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const body = await req.json().catch(() => ({}))
  const replace = body.replace === true
  const source = body.source === 'download' ? 'download' : 'bundled'

  try {
    const rows = await loadAnimationImportRows(source)
    const result = await importFunkoRows('animation', rows, { replace })

    return NextResponse.json({
      ...result,
      total: rows.length,
      message:
        result.imported > 0
          ? `Импортировано ${result.imported} из ${rows.length} фигурок Pop! Animation`
          : result.skipped === rows.length
            ? 'Каталог уже заполнен — для повторного импорта передайте replace: true'
            : 'Импорт завершён',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[funko/import-animations]:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
