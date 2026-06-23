import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { ensureFilesSeed, getCategoryBySlug } from '@/lib/files/ensureFilesSeed'
import { getFolderStoragePrefix } from '@/lib/files/folderService'
import { gcsObjectKey, uploadToGcs } from '@/lib/files/gcsStorage'
import { extForMime } from '@/lib/files/localStorage'
import { rowToFileCategory } from '@/lib/files/mapRow'
import { resolveUploadMime } from '@/lib/files/mimeDetect'
import { LOCAL_ALLOWED_MIMES, MAX_FILE_BYTES, MAX_FILE_SIZE_ERROR } from '@/lib/files/types'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  await ensureFilesSeed()

  const form = await req.formData()
  const fileId = String(form.get('fileId') ?? '').trim()
  const categorySlug = String(form.get('categorySlug') ?? '').trim()
  const folderIdRaw = form.get('folderId')
  const folderId = folderIdRaw ? String(folderIdRaw).trim() : null
  const mimeRaw = String(form.get('mime') ?? '').trim()
  const fileName = String(form.get('fileName') ?? '').trim()
  const file = form.get('file')

  if (!fileId || !categorySlug || !(file instanceof File)) {
    return NextResponse.json({ error: 'Неполные данные загрузки' }, { status: 400 })
  }

  const categoryRow = await getCategoryBySlug(categorySlug)
  if (!categoryRow) {
    return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })
  }

  const category = rowToFileCategory(categoryRow)
  if (category.storageType !== 'gcs') {
    return NextResponse.json({ error: 'Категория не использует облако' }, { status: 400 })
  }

  let mime: string
  try {
    const trimmedMime = mimeRaw.trim().toLowerCase()
    if (trimmedMime && LOCAL_ALLOWED_MIMES.has(trimmedMime)) {
      mime = trimmedMime
    } else {
      mime = resolveUploadMime(fileName || file.name, mimeRaw || file.type || '')
    }
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
    const folderPrefix = folderId ? await getFolderStoragePrefix(folderId) : ''
    const ext = extForMime(mime)
    const storagePath = gcsObjectKey(categorySlug, folderPrefix, fileId, ext)
    await uploadToGcs(storagePath, buffer, mime)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[gcs-proxy-put]', fileName, message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
