import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { ensureFilesSeed } from '@/lib/files/ensureFilesSeed'
import { listGalleryImages } from '@/lib/gallery/galleryService'
import { groupGalleryByYearMonth } from '@/lib/gallery/groupByDate'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  await ensureFilesSeed()

  const items = await listGalleryImages()
  const grouped = groupGalleryByYearMonth(items)

  return NextResponse.json({ items, grouped })
}
