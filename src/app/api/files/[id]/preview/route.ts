import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import {
  fetchFileRow,
  ensureFilePreview,
  readFilePreview,
  readFileContent,
} from '@/lib/files/fileService'
import { getGcsReadSignedUrl } from '@/lib/files/gcsStorage'
import { PREVIEW_CACHE_CONTROL, isThumbnailPreviewPath } from '@/lib/files/previewConstants'

export const runtime = 'nodejs'
export const maxDuration = 60

function previewResponse(buffer: Buffer): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': PREVIEW_CACHE_CONTROL,
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

  const storageType = row.category_storage_type as string
  const fileMime = row.mime_type as string
  const previewPath = row.preview_path as string | null
  const storagePath = row.storage_path as string

  if (isThumbnailPreviewPath(previewPath, storagePath)) {
    const cached = await readFilePreview(row)
    if (cached) return previewResponse(cached)
  }

  const generated = await ensureFilePreview(row)
  if (generated) return previewResponse(generated)

  if (fileMime.startsWith('image/')) {
    if (storageType === 'gcs') {
      const url = await getGcsReadSignedUrl(storagePath)
      return NextResponse.redirect(url, 307)
    }
    const buffer = await readFileContent(row)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': fileMime,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  }

  return NextResponse.json({ error: 'Превью недоступно' }, { status: 404 })
}
