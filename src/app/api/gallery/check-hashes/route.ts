import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { ensureFilesSeed } from '@/lib/files/ensureFilesSeed'
import { findExistingHashes, getGalleryCategoryId } from '@/lib/gallery/galleryService'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  await ensureFilesSeed()

  const body = await req.json()
  const hashes = Array.isArray(body.hashes)
    ? body.hashes.map((h: unknown) => String(h ?? '').trim()).filter(Boolean)
    : []

  if (!hashes.length) {
    return NextResponse.json({ existing: {} })
  }

  const categoryId = await getGalleryCategoryId()
  if (!categoryId) {
    return NextResponse.json({ error: 'Категория галереи не найдена' }, { status: 404 })
  }

  const existing = await findExistingHashes(categoryId, hashes)
  return NextResponse.json({ existing })
}
