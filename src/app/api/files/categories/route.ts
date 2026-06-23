import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { ensureFilesSeed } from '@/lib/files/ensureFilesSeed'
import { rowToFileCategory } from '@/lib/files/mapRow'
import { isGcsConfigured } from '@/lib/files/gcsStorage'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  try {
    await ensureFilesSeed()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message, categories: [] }, { status: 500 })
  }

  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM file_categories ORDER BY sort_order ASC, name ASC',
  )

  return NextResponse.json({
    categories: rows.map(rowToFileCategory),
    gcsConfigured: isGcsConfigured(),
  })
}
