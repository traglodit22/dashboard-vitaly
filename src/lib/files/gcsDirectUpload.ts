import { apiFetch } from '@/lib/apiFetch'

const DIRECT_UPLOAD_TIMEOUT_MS = 600_000

export class GcsUploadError extends Error {
  constructor(
    message: string,
    readonly via: 'direct' | 'proxy',
  ) {
    super(message)
    this.name = 'GcsUploadError'
  }
}

/** PUT напрямую в GCS по signed URL (только вне браузера). */
export async function putFileToGcsSignedUrl(
  uploadUrl: string,
  file: File,
  mime: string,
  timeoutMs = DIRECT_UPLOAD_TIMEOUT_MS,
): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': mime },
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new GcsUploadError(
        `Google Cloud отклонил загрузку (${res.status})${text ? `: ${text.slice(0, 160)}` : ''}`,
        'direct',
      )
    }
  } catch (err) {
    if (err instanceof GcsUploadError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GcsUploadError('Таймаут прямой загрузки в Google Cloud', 'direct')
    }
    const message = err instanceof Error ? err.message : String(err)
    throw new GcsUploadError(message || 'Не удалось загрузить в Google Cloud напрямую', 'direct')
  } finally {
    clearTimeout(timer)
  }
}

/** Загрузка через VPS — signed URL генерируется на сервере по fileId. */
export async function putFileToGcsViaProxy(
  opts: {
    fileId: string
    categorySlug: string
    folderId: string | null
    file: File
    mime: string
    fileName: string
  },
  timeoutMs = DIRECT_UPLOAD_TIMEOUT_MS,
): Promise<void> {
  const fd = new FormData()
  fd.append('fileId', opts.fileId)
  fd.append('categorySlug', opts.categorySlug)
  if (opts.folderId) fd.append('folderId', opts.folderId)
  fd.append('mime', opts.mime)
  fd.append('fileName', opts.fileName)
  fd.append('file', opts.file)

  let res: Response
  try {
    res = await apiFetch('/api/files/gcs-proxy-put', { method: 'POST', body: fd }, timeoutMs)
  } catch {
    throw new GcsUploadError('Таймаут загрузки через сервер', 'proxy')
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    const detail = data.error?.trim()
    if (res.status === 413) {
      throw new GcsUploadError(
        'Файл слишком большой для сервера (лимит nginx). Обратитесь к администратору.',
        'proxy',
      )
    }
    throw new GcsUploadError(detail || `Ошибка загрузки через сервер (HTTP ${res.status})`, 'proxy')
  }
}

/**
 * В браузере всегда через прокси (Safari ломается на fetch к signed URL).
 * Вне браузера — прямой PUT с fallback на прокси.
 */
export async function uploadFileToGcsWithFallback(opts: {
  fileId: string
  categorySlug: string
  folderId?: string | null
  uploadUrl: string
  file: File
  mime: string
  fileName: string
}): Promise<'direct' | 'proxy'> {
  const folderId = opts.folderId ?? null

  if (typeof window !== 'undefined') {
    await putFileToGcsViaProxy({
      fileId: opts.fileId,
      categorySlug: opts.categorySlug,
      folderId,
      file: opts.file,
      mime: opts.mime,
      fileName: opts.fileName,
    })
    return 'proxy'
  }

  try {
    await putFileToGcsSignedUrl(opts.uploadUrl, opts.file, opts.mime)
    return 'direct'
  } catch (directErr) {
    try {
      await putFileToGcsViaProxy({
        fileId: opts.fileId,
        categorySlug: opts.categorySlug,
        folderId,
        file: opts.file,
        mime: opts.mime,
        fileName: opts.fileName,
      })
      return 'proxy'
    } catch (proxyErr) {
      const directMsg =
        directErr instanceof Error ? directErr.message : 'прямая загрузка не удалась'
      const proxyMsg =
        proxyErr instanceof Error ? proxyErr.message : 'загрузка через сервер не удалась'
      throw new GcsUploadError(`${proxyMsg} (прямая: ${directMsg})`, 'proxy')
    }
  }
}
