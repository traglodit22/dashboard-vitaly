import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { fetchFileRow, ensureFilePreview, readFileContent } from '@/lib/files/fileService'

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

  let buffer = await ensureFilePreview(row)
  let mime = 'image/webp'

  if (!buffer) {
    const fileMime = row.mime_type as string
    if (fileMime.startsWith('image/')) {
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
