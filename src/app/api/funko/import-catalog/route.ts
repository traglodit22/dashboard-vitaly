import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getCategoryDef } from '@/lib/funko/categoryConfig'
import { importFunkoRows } from '@/lib/funko/funkoService'
import { listImportableCategories, loadCategoryImportRows } from '@/lib/funko/loadCategoryData'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const body = await req.json().catch(() => ({}))
  const replace = body.replace === true
  const source = body.source === 'download' ? 'download' : 'bundled'
  const all = body.all === true || !body.categorySlug
  const slug = typeof body.categorySlug === 'string' ? body.categorySlug.trim() : ''

  const targets = all
    ? listImportableCategories()
    : [getCategoryDef(slug)].filter(Boolean)

  if (!targets.length) {
    return NextResponse.json({ error: 'Категория не найдена' }, { status: 400 })
  }

  const results: {
    slug: string
    name: string
    total: number
    imported: number
    skipped: number
    message: string
  }[] = []

  try {
    for (const def of targets) {
      if (!def) continue
      const rows = await loadCategoryImportRows(def.slug, source)
      const result = await importFunkoRows(def.slug, rows, { replace })
      results.push({
        slug: def.slug,
        name: def.name,
        total: rows.length,
        ...result,
        message:
          rows.length === 0
            ? 'Нет данных в источнике'
            : result.imported > 0
              ? `Импортировано ${result.imported} из ${rows.length}`
              : 'Каталог уже заполнен',
      })
    }

    const importedTotal = results.reduce((n, r) => n + r.imported, 0)
    return NextResponse.json({
      ok: true,
      importedTotal,
      results,
      message:
        importedTotal > 0
          ? `Импортировано ${importedTotal} фигурок в ${results.filter((r) => r.imported > 0).length} категориях`
          : 'Каталоги уже заполнены — для перезаписи передайте replace: true',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[funko/import-catalog]:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
