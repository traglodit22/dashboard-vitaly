import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import {
  importAllFunkoCollections,
  importFunkoCollectionFromFile,
} from '@/lib/funko/importCollection'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const body = await req.json().catch(() => ({}))
  const categorySlug =
    typeof body.categorySlug === 'string' ? body.categorySlug.trim() : ''
  const all = body.all === true || !categorySlug

  try {
    if (all) {
      const results = await importAllFunkoCollections()
      const imported = results.reduce((n, r) => n + r.imported, 0)
      const updated = results.reduce((n, r) => n + r.updated, 0)
      const withImages = results.reduce((n, r) => n + r.withImages, 0)
      return NextResponse.json({
        results,
        imported,
        updated,
        withImages,
        message: `Коллекция импортирована: ${updated} обновлено, ${imported} добавлено (${withImages} с фото)`,
      })
    }

    const result = await importFunkoCollectionFromFile(categorySlug)
    return NextResponse.json({
      ...result,
      message: `${categorySlug}: ${result.updated} обновлено, ${result.imported} добавлено (${result.withImages} с фото)`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[funko/import-collection]:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
