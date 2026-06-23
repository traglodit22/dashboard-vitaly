import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { fetchFileRow, readFileContent } from '@/lib/files/fileService'

export const runtime = 'nodejs'

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

  const buffer = await readFileContent(row)
  const mime = row.mime_type as string
  const name = row.original_name as string

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
