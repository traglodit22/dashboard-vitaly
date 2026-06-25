import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { importFunkoCollectionFromFile } from '@/lib/funko/importCollection'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  try {
    const result = await importFunkoCollectionFromFile()
    return NextResponse.json({
      ...result,
      message: `Импортировано ${result.imported} фигурок Animation (${result.withImages} с фото из каталога)`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[funko/import-collection]:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
