import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { putBufferToSignedUrl } from '@/lib/files/gcsStorage'
import { resolveUploadMime } from '@/lib/files/mimeDetect'
import { MAX_FILE_BYTES, MAX_FILE_SIZE_ERROR } from '@/lib/files/types'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const form = await req.formData()
  const uploadUrl = String(form.get('uploadUrl') ?? '').trim()
  const mimeRaw = String(form.get('mime') ?? '').trim()
  const fileName = String(form.get('fileName') ?? '').trim()
  const file = form.get('file')

  if (!uploadUrl || !(file instanceof File)) {
    return NextResponse.json({ error: 'Неполные данные загрузки' }, { status: 400 })
  }

  let mime: string
  try {
    mime = resolveUploadMime(fileName || file.name, mimeRaw || file.type || '')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > MAX_FILE_BYTES) {
    return NextResponse.json({ error: MAX_FILE_SIZE_ERROR }, { status: 400 })
  }
  if (file.size && buffer.length !== file.size) {
    return NextResponse.json({ error: 'Файл передан не полностью' }, { status: 400 })
  }

  try {
    await putBufferToSignedUrl(uploadUrl, buffer, mime)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
