import fs from 'fs/promises'
import path from 'path'

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const IMAGE_EXTS = ['jpg', 'png', 'webp', 'gif'] as const

export function procurementImagesDir(): string {
  const base = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
  return path.join(base, 'procurement')
}

function filePath(id: string, ext: string): string {
  return path.join(procurementImagesDir(), `${id}.${ext}`)
}

export function extForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    default:
      return 'bin'
  }
}

export function mimeForExt(ext: string): string {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}

export async function ensureImagesDir(): Promise<void> {
  await fs.mkdir(procurementImagesDir(), { recursive: true })
}

export async function deleteItemImageFiles(id: string): Promise<void> {
  await Promise.all(
    IMAGE_EXTS.map(async (ext) => {
      try {
        await fs.unlink(filePath(id, ext))
      } catch {
        /* no file */
      }
    }),
  )
}

export async function saveItemImageFile(
  id: string,
  buffer: Buffer,
  mime: string,
): Promise<string> {
  if (!ALLOWED_MIMES.has(mime)) {
    throw new Error('Допустимы JPEG, PNG, WebP или GIF')
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Максимальный размер — 5 МБ')
  }
  await ensureImagesDir()
  await deleteItemImageFiles(id)
  const ext = extForMime(mime)
  await fs.writeFile(filePath(id, ext), buffer)
  return ext
}

export async function findItemImageFile(
  id: string,
): Promise<{ path: string; ext: string } | null> {
  for (const ext of IMAGE_EXTS) {
    const p = filePath(id, ext)
    try {
      await fs.access(p)
      return { path: p, ext }
    } catch {
      /* try next */
    }
  }
  return null
}
