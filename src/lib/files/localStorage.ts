import fs from 'fs/promises'
import path from 'path'
import { LOCAL_ALLOWED_MIMES, MAX_FILE_BYTES, MAX_FILE_SIZE_ERROR, FOLDER_KEEP_NAME } from '@/lib/files/types'
import { mimeToExtension } from '@/lib/files/mimeDetect'

export function filesUploadRoot(): string {
  const base = process.env.UPLOAD_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), 'uploads')
  return path.join(base, 'files')
}

export function localCategoryDir(categorySlug: string): string {
  return path.join(filesUploadRoot(), categorySlug)
}

export function localFolderDir(categorySlug: string, folderPrefix: string): string {
  if (!folderPrefix) return localCategoryDir(categorySlug)
  return path.join(localCategoryDir(categorySlug), ...folderPrefix.split('/'))
}

export function localFilePath(
  categorySlug: string,
  folderPrefix: string,
  fileId: string,
  ext: string,
): string {
  return path.join(localFolderDir(categorySlug, folderPrefix), `${fileId}.${ext}`)
}

export function localPreviewPath(
  categorySlug: string,
  folderPrefix: string,
  fileId: string,
): string {
  return path.join(localFolderDir(categorySlug, folderPrefix), `${fileId}-preview.webp`)
}

export function localRelativePath(
  categorySlug: string,
  folderPrefix: string,
  fileName: string,
): string {
  return path.join('files', categorySlug, folderPrefix ? `${folderPrefix}/${fileName}` : fileName)
}

export function extForMime(mime: string): string {
  return mimeToExtension(mime) ?? 'bin'
}

export function validateLocalUpload(mime: string, size: number): void {
  if (!LOCAL_ALLOWED_MIMES.has(mime)) {
    throw new Error('Допустимы PDF, изображения (в т.ч. TIFF), DOC/DOCX, XLS/XLSX, TXT, ZIP, DWG и AI')
  }
  if (size > MAX_FILE_BYTES) {
    throw new Error(MAX_FILE_SIZE_ERROR)
  }
}

export async function ensureLocalFolder(categorySlug: string, folderPrefix: string): Promise<void> {
  const dir = localFolderDir(categorySlug, folderPrefix)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, FOLDER_KEEP_NAME), '')
}

export async function removeLocalFolderKeep(
  categorySlug: string,
  folderPrefix: string,
): Promise<void> {
  try {
    await fs.unlink(path.join(localFolderDir(categorySlug, folderPrefix), FOLDER_KEEP_NAME))
  } catch {
    /* missing */
  }
}

export async function saveLocalFile(
  categorySlug: string,
  folderPrefix: string,
  fileId: string,
  buffer: Buffer,
  mime: string,
): Promise<{ storagePath: string; ext: string }> {
  validateLocalUpload(mime, buffer.length)
  const ext = extForMime(mime)
  const dir = localFolderDir(categorySlug, folderPrefix)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, `${fileId}.${ext}`), buffer)
  return { storagePath: localRelativePath(categorySlug, folderPrefix, `${fileId}.${ext}`), ext }
}

export async function saveLocalPreview(
  categorySlug: string,
  folderPrefix: string,
  fileId: string,
  buffer: Buffer,
): Promise<string> {
  const dir = localFolderDir(categorySlug, folderPrefix)
  await fs.mkdir(dir, { recursive: true })
  const rel = localRelativePath(categorySlug, folderPrefix, `${fileId}-preview.webp`)
  await fs.writeFile(path.join(dir, `${fileId}-preview.webp`), buffer)
  return rel
}

export async function readLocalRelative(relPath: string): Promise<Buffer> {
  const root = process.env.UPLOAD_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), 'uploads')
  const full = path.normalize(path.join(root, relPath))
  const rootNorm = path.normalize(root + path.sep)
  if (!full.startsWith(rootNorm) && full !== path.normalize(root)) {
    throw new Error('Invalid path')
  }
  return fs.readFile(full)
}

export async function writeLocalRelative(relPath: string, buffer: Buffer): Promise<void> {
  const root = process.env.UPLOAD_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), 'uploads')
  const full = path.normalize(path.join(root, relPath))
  const rootNorm = path.normalize(root + path.sep)
  if (!full.startsWith(rootNorm) && full !== path.normalize(root)) {
    throw new Error('Invalid path')
  }
  await fs.mkdir(path.dirname(full), { recursive: true })
  await fs.writeFile(full, buffer)
}

export async function deleteLocalRelative(relPath: string): Promise<void> {
  try {
    const root = process.env.UPLOAD_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), 'uploads')
    await fs.unlink(path.normalize(path.join(root, relPath)))
  } catch {
    /* missing */
  }
}
