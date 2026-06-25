import { query } from '@/lib/db/index'
import { isAllowedFunkoImageProxyUrl } from '@/lib/funko/funkoImageProxy'
import { deleteFromGcs, downloadFromGcs, isGcsConfigured, uploadToGcs } from '@/lib/files/gcsStorage'
import { mimeToExtension } from '@/lib/files/mimeDetect'

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export function funkoGcsObjectKey(itemId: string, ext: string): string {
  return `dashboard/funko/${itemId}.${ext}`
}

export function isFunkoOwnedGcsKey(key: string | null | undefined): boolean {
  return Boolean(key?.startsWith('dashboard/funko/'))
}

export async function deleteFunkoGcsImage(key: string | null | undefined): Promise<void> {
  if (!isFunkoOwnedGcsKey(key)) return
  if (!isGcsConfigured()) return
  try {
    await deleteFromGcs(key!)
  } catch (err) {
    console.error('[funko] delete gcs image:', err)
  }
}

export async function downloadRemoteImage(
  url: string,
): Promise<{ buffer: Buffer; mime: string }> {
  if (!isAllowedFunkoImageProxyUrl(url)) {
    throw new Error('URL изображения не разрешён')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'image/*',
        'User-Agent': 'Mozilla/5.0 (compatible; DashBoardTrag/1.0)',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const mime = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim()
    if (!IMAGE_MIMES.has(mime)) {
      throw new Error('Файл не является изображением')
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new Error('Изображение слишком большое (макс. 8 МБ)')
    }
    return { buffer, mime }
  } finally {
    clearTimeout(timer)
  }
}

export async function setFunkoItemImage(
  itemId: string,
  buffer: Buffer,
  mime: string,
): Promise<{ gcsKey: string }> {
  if (!IMAGE_MIMES.has(mime)) {
    throw new Error('Допустимы JPEG, PNG, WebP, GIF')
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Изображение слишком большое (макс. 8 МБ)')
  }
  if (!isGcsConfigured()) {
    throw new Error('Google Cloud Storage не настроен')
  }

  const rows = await query<{ image_gcs_key: string | null }>(
    'SELECT image_gcs_key FROM funko_items WHERE id = $1',
    [itemId],
  )
  const prevKey = rows[0]?.image_gcs_key ?? null

  const ext = mimeToExtension(mime) ?? 'jpg'
  const gcsKey = funkoGcsObjectKey(itemId, ext)
  await uploadToGcs(gcsKey, buffer, mime)
  await deleteFunkoGcsImage(prevKey !== gcsKey ? prevKey : null)

  await query(
    `UPDATE funko_items
     SET image_gcs_key = $1, image_url = NULL, updated_at = NOW()
     WHERE id = $2`,
    [gcsKey, itemId],
  )

  return { gcsKey }
}

export async function clearFunkoItemImage(itemId: string): Promise<void> {
  const rows = await query<{ image_gcs_key: string | null }>(
    'SELECT image_gcs_key FROM funko_items WHERE id = $1',
    [itemId],
  )
  const key = rows[0]?.image_gcs_key ?? null
  await deleteFunkoGcsImage(key)
  await query(
    `UPDATE funko_items
     SET image_gcs_key = NULL, image_url = NULL, updated_at = NOW()
     WHERE id = $1`,
    [itemId],
  )
}

export async function readFunkoGcsImage(key: string): Promise<Buffer> {
  return downloadFromGcs(key)
}
