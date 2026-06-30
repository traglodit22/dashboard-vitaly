/** SHA-256 и EXIF на клиенте до загрузки (дедуп без лишнего PUT в GCS). */
export async function sha256HexFromBuffer(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256HexBrowser(file: File): Promise<string> {
  return sha256HexFromBuffer(await file.arrayBuffer())
}

export async function extractCapturedAtFromBuffer(
  buf: ArrayBuffer,
  mime: string,
): Promise<string | null> {
  if (!mime.startsWith('image/')) return null
  try {
    const exifr = (await import('exifr')).default
    const exif = await exifr.parse(buf, {
      pick: ['DateTimeOriginal', 'CreateDate', 'DateTime', 'ModifyDate'],
    })
    const raw =
      exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.DateTime ?? exif?.ModifyDate
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString()
    if (typeof raw === 'string') {
      const parsed = new Date(raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'))
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
    }
  } catch {
    /* no exif */
  }
  return null
}

export async function extractCapturedAtBrowser(file: File): Promise<string | null> {
  return extractCapturedAtFromBuffer(await file.arrayBuffer(), file.type)
}
