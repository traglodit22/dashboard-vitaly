import { LOCAL_ALLOWED_MIMES } from '@/lib/files/types'

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

export function mimeFromFileName(fileName: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (!ext) return null
  return EXT_TO_MIME[ext] ?? null
}

/** Браузер часто отдаёт пустой type или octet-stream для PDF — определяем по имени. */
export function resolveUploadMime(fileName: string, reportedType: string): string {
  const trimmed = reportedType.trim().toLowerCase()
  if (trimmed && LOCAL_ALLOWED_MIMES.has(trimmed)) return trimmed

  const fromName = mimeFromFileName(fileName)
  if (fromName) return fromName

  if (trimmed && trimmed !== 'application/octet-stream') {
    throw new Error(`Неподдерживаемый тип файла: ${trimmed}`)
  }

  throw new Error('Допустимы PDF и изображения (JPEG, PNG, WebP, GIF)')
}

export function isPdfMime(mime: string): boolean {
  return mime === 'application/pdf'
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/')
}
