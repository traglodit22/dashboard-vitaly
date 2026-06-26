import { LOCAL_ALLOWED_MIMES } from '@/lib/files/types'
import { uploadBaseName } from '@/lib/files/uploadNames'

export const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  zip: 'application/zip',
  pages: 'application/x-iwork-pages-sffpages',
  dwg: 'image/vnd.dwg',
}

const GENERIC_BINARY = new Set(['application/octet-stream', 'application/zip'])

export function mimeFromFileName(fileName: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (!ext) return null
  return EXT_TO_MIME[ext] ?? null
}

/** Браузер часто отдаёт пустой type или octet-stream — определяем по расширению. */
export function resolveUploadMime(fileName: string, reportedType: string): string {
  const baseName = uploadBaseName(fileName)
  const trimmed = reportedType.trim().toLowerCase()
  const fromName = mimeFromFileName(baseName)

  if (fromName && (!trimmed || GENERIC_BINARY.has(trimmed))) {
    return fromName
  }

  if (trimmed && LOCAL_ALLOWED_MIMES.has(trimmed)) return trimmed

  if (fromName) return fromName

  if (trimmed && !GENERIC_BINARY.has(trimmed)) {
    throw new Error(`Неподдерживаемый тип файла: ${trimmed}`)
  }

  throw new Error(
    'Допустимы PDF, изображения, DOC/DOCX, XLS/XLSX, Pages, TXT, ZIP и DWG',
  )
}

export function isPdfMime(mime: string, fileName?: string): boolean {
  if (mime === 'application/pdf' || mime === 'application/x-pdf') return true
  return fileName?.toLowerCase().endsWith('.pdf') ?? false
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/')
}

export function isTextMime(mime: string): boolean {
  return mime === 'text/plain'
}

export function mimeToExtension(mime: string): string | null {
  for (const [ext, type] of Object.entries(EXT_TO_MIME)) {
    if (type === mime) return ext
  }
  return null
}
