import fs from 'fs/promises'
import path from 'path'
import { LOCAL_ALLOWED_MIMES, MAX_FILE_BYTES } from '@/lib/files/types'

export function filesUploadRoot(): string {
  const base = process.env.UPLOAD_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "uploads")
  return path.join(base, "files")
}

export function localCategoryDir(categorySlug: string): string {
  return path.join(filesUploadRoot(), categorySlug)
}

export function localFilePath(categorySlug: string, fileId: string, ext: string): string {
  return path.join(localCategoryDir(categorySlug), `${fileId}.${ext}`)
}

export function localPreviewPath(categorySlug: string, fileId: string): string {
  return path.join(localCategoryDir(categorySlug), `${fileId}-preview.webp`)
}

export function extForMime(mime: string): string {
  switch (mime) {
    case 'application/pdf':
      return 'pdf'
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
    case 'pdf':
      return 'application/pdf'
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

export function validateLocalUpload(mime: string, size: number): void {
  if (!LOCAL_ALLOWED_MIMES.has(mime)) {
    throw new Error('Допустимы PDF и изображения (JPEG, PNG, WebP, GIF)')
  }
  if (size > MAX_FILE_BYTES) {
    throw new Error('Максимальный размер файла — 20 МБ')
  }
}

export async function ensureCategoryDir(categorySlug: string): Promise<void> {
  await fs.mkdir(localCategoryDir(categorySlug), { recursive: true })
}

export async function saveLocalFile(
  categorySlug: string,
  fileId: string,
  buffer: Buffer,
  mime: string,
): Promise<{ storagePath: string; ext: string }> {
  validateLocalUpload(mime, buffer.length)
  await ensureCategoryDir(categorySlug)
  const ext = extForMime(mime)
  const rel = path.join('files', categorySlug, `${fileId}.${ext}`)
  await fs.writeFile(localFilePath(categorySlug, fileId, ext), buffer)
  return { storagePath: rel, ext }
}

export async function saveLocalPreview(
  categorySlug: string,
  fileId: string,
  buffer: Buffer,
): Promise<string> {
  await ensureCategoryDir(categorySlug)
  const rel = path.join('files', categorySlug, `${fileId}-preview.webp`)
  await fs.writeFile(localPreviewPath(categorySlug, fileId), buffer)
  return rel
}

export async function readLocalRelative(relPath: string): Promise<Buffer> {
  const root = process.env.UPLOAD_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "uploads")
  const full = path.normalize(path.join(root, relPath))
  const rootNorm = path.normalize(root + path.sep)
  if (!full.startsWith(rootNorm) && full !== path.normalize(root)) {
    throw new Error('Invalid path')
  }
  return fs.readFile(full)
}

export async function deleteLocalFiles(
  categorySlug: string,
  fileId: string,
  ext: string,
  hasPreview: boolean,
): Promise<void> {
  const targets = [localFilePath(categorySlug, fileId, ext)]
  if (hasPreview) targets.push(localPreviewPath(categorySlug, fileId))
  await Promise.all(
    targets.map(async (p) => {
      try {
        await fs.unlink(p)
      } catch {
        /* missing */
      }
    }),
  )
}
