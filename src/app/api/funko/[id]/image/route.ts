import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import {
  clearFunkoItemImage,
  downloadRemoteImage,
  setFunkoItemImage,
} from '@/lib/funko/funkoImage'
import { getFunkoItemById } from '@/lib/funko/funkoService'

export const runtime = 'nodejs'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  const item = await getFunkoItemById(id)
  if (!item) {
    return NextResponse.json({ error: 'Фигурка не найдена' }, { status: 404 })
  }

  const contentType = req.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const mime = file.type || 'image/jpeg'
      await setFunkoItemImage(id, buffer, mime)
    } else {
      const body = await req.json()
      const sourceUrl = String(body.sourceUrl ?? '').trim()
      if (!sourceUrl) {
        return NextResponse.json({ error: 'Укажите sourceUrl или загрузите файл' }, { status: 400 })
      }
      const { buffer, mime } = await downloadRemoteImage(sourceUrl)
      await setFunkoItemImage(id, buffer, mime)
    }

    const updated = await getFunkoItemById(id)
    return NextResponse.json({ item: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось сохранить изображение'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  const item = await getFunkoItemById(id)
  if (!item) {
    return NextResponse.json({ error: 'Фигурка не найдена' }, { status: 404 })
  }

  await clearFunkoItemImage(id)
  const updated = await getFunkoItemById(id)
  return NextResponse.json({ item: updated })
}
