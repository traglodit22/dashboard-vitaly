import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { fetchFileRow, readFileContent } from '@/lib/files/fileService'
import { getGcsReadSignedUrl } from '@/lib/files/gcsStorage'

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

  const storageType = row.category_storage_type as string
  const mime = row.mime_type as string
  const name = row.original_name as string
  const download = new URL(req.url).searchParams.get('download') === '1'

  if (storageType === 'gcs') {
    const url = await getGcsReadSignedUrl(row.storage_path as string, {
      attachment: download,
      fileName: name,
    })
    return NextResponse.redirect(url, 307)
  }

  const buffer = await readFileContent(row)
  const disposition = download ? 'attachment' : 'inline'

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
