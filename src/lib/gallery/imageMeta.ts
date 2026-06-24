import { createHash } from 'crypto'
import exifr from 'exifr'

export function sha256Hex(buffer: Buffer | Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/** Дата съёмки из EXIF или null. */
export async function extractCapturedAt(
  buffer: Buffer | Uint8Array,
  mime: string,
): Promise<Date | null> {
  if (!mime.startsWith('image/')) return null
  try {
    const exif = await exifr.parse(buffer, {
      pick: ['DateTimeOriginal', 'CreateDate', 'DateTime', 'ModifyDate'],
    })
    const raw =
      exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.DateTime ?? exif?.ModifyDate
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw
    if (typeof raw === 'string') {
      const parsed = new Date(raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'))
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
  } catch {
    /* no exif */
  }
  return null
}

export async function analyzeImageBuffer(
  buffer: Buffer | Uint8Array,
  mime: string,
): Promise<{ contentHash: string; capturedAt: Date | null }> {
  const contentHash = sha256Hex(buffer)
  const capturedAt = await extractCapturedAt(buffer, mime)
  return { contentHash, capturedAt }
}
