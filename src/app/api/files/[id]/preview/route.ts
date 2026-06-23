import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { fetchFileRow, ensureFilePreview, readFilePreview, readFileContent } from '@/lib/files/fileService'
import { getGcsReadSignedUrl } from '@/lib/files/gcsStorage'

export const runtime = 'nodejs'
export const maxDuration = 60

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

  if (
    storageType === 'gcs' &&
    previewPath &&
    (fileMime.startsWith('image/') || previewPath.endsWith('-preview.webp'))
  ) {
    const url = await getGcsReadSignedUrl(previewPath)
    return NextResponse.redirect(url, 307)
  }

  if (storageType === 'local' && previewPath) {
    const cached = await readFilePreview(row)
    if (cached) {
      return new NextResponse(new Uint8Array(cached), {
        headers: {
          'Content-Type': previewPath.endsWith('.webp') ? 'image/webp' : fileMime,
          'Cache-Control': 'private, max-age=3600',
        },
      })
    }
  }

  let buffer = await ensureFilePreview(row)
  let mime = 'image/webp'

  if (!buffer) {
    if (fileMime.startsWith('image/')) {
      if (storageType === 'gcs') {
        const url = await getGcsReadSignedUrl(row.storage_path as string)
        return NextResponse.redirect(url, 307)
      }
      buffer = await readFileContent(row)
      mime = fileMime
    } else {
      return NextResponse.json({ error: 'Превью недоступно' }, { status: 404 })
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
