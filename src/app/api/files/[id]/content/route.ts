import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { fetchFileRow, readFileContent, writeFileContent } from '@/lib/files/fileService'
import { getGcsReadSignedUrl } from '@/lib/files/gcsStorage'
import { isTextMime } from '@/lib/files/mimeDetect'
import { rowToFileItem } from '@/lib/files/mapRow'

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
  const inline = new URL(req.url).searchParams.get('inline') === '1'

  if (inline && isTextMime(mime)) {
    const buffer = await readFileContent(row)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'private, max-age=0',
      },
    })
  }

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

export async function PUT(
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

  const mime = row.mime_type as string
  if (!isTextMime(mime)) {
    return NextResponse.json({ error: 'Редактировать можно только текстовые заметки' }, { status: 400 })
  }

  let content: string
  try {
    const body = await req.json()
    if (typeof body.content !== 'string') {
      return NextResponse.json({ error: 'Укажите content' }, { status: 400 })
    }
    content = body.content
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(content, 'utf8')
    await writeFileContent(row, buffer)
    const item = await fetchFileRow(id)
    return NextResponse.json({ item: item ? rowToFileItem(item) : null })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
