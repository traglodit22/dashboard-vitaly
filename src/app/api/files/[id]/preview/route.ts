import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import {
  fetchFileRow,
  readFilePreview,
} from '@/lib/files/fileService'
import { isPdfMime } from '@/lib/files/mimeDetect'
import { getGcsReadSignedUrl } from '@/lib/files/gcsStorage'
import { PREVIEW_CACHE_CONTROL, isThumbnailPreviewPath } from '@/lib/files/previewConstants'
import { getCachedPreview, setCachedPreview } from '@/lib/files/previewMemoryCache'
import { schedulePreviewGeneration } from '@/lib/files/previewQueue'

export const runtime = 'nodejs'
export const maxDuration = 60

function previewEtag(row: Record<string, unknown>): string {
  const id = row.id as string
  const previewPath = (row.preview_path as string | null) ?? ''
  const updatedAt = row.updated_at instanceof Date
    ? row.updated_at.toISOString()
    : String(row.updated_at ?? '')
  return `"${id}-${previewPath}-${updatedAt}"`
}

function previewResponse(buffer: Buffer, etag: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': PREVIEW_CACHE_CONTROL,
      ETag: etag,
    },
  })
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  const row = await fetchFileRow(id)
  if (!row) {
    return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })
  }

  const fileMime = row.mime_type as string
  const originalName = row.original_name as string
  const previewPath = row.preview_path as string | null
  const storagePath = row.storage_path as string
  const isPdf = isPdfMime(fileMime, originalName)
  const etag = previewEtag(row)

  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': PREVIEW_CACHE_CONTROL,
      },
    })
  }

  if (isThumbnailPreviewPath(previewPath, storagePath)) {
    const mem = getCachedPreview(id, etag)
    if (mem) return previewResponse(mem, etag)

    const cached = await readFilePreview(row)
    if (cached) {
      setCachedPreview(id, etag, cached)
      return previewResponse(cached, etag)
    }
  }

  if (fileMime.startsWith('image/') || isPdf) {
    schedulePreviewGeneration(id)
    if (fileMime.startsWith('image/') && row.category_storage_type === 'gcs') {
      const url = await getGcsReadSignedUrl(storagePath)
      return NextResponse.redirect(url, 307)
    }
    return NextResponse.json({ error: 'Превью готовится' }, { status: 404 })
  }

  return NextResponse.json({ error: 'Превью недоступно' }, { status: 404 })
}
