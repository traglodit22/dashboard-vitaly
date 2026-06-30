import { apiFetch } from '@/lib/apiFetch'
import { formatUploadClientError } from '@/lib/files/uploadNames'

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

function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Safari/i.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|FxiOS|Edg/i.test(navigator.userAgent)
}

function xhrPostForm(fd: FormData, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/files/gcs-proxy-put')
    xhr.timeout = timeoutMs
    xhr.withCredentials = true
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(new GcsUploadError(`Ошибка загрузки через сервер (HTTP ${xhr.status})`, 'proxy'))
    }
    xhr.onerror = () => reject(new GcsUploadError('Сбой сети при загрузке через сервер', 'proxy'))
    xhr.ontimeout = () => reject(new GcsUploadError('Таймаут загрузки через сервер', 'proxy'))
    xhr.send(fd)
  })
}

/** PUT напрямую в GCS по signed URL (минует VPS). */
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
    throw new GcsUploadError(formatUploadClientError(err), 'direct')
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
  fd.append('file', opts.file, 'upload')

  if (typeof window !== 'undefined' && isSafari()) {
    await xhrPostForm(fd, timeoutMs)
    return
  }

  let res: Response
  try {
    res = await apiFetch('/api/files/gcs-proxy-put', { method: 'POST', body: fd }, timeoutMs)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GcsUploadError('Таймаут загрузки через сервер', 'proxy')
    }
    throw new GcsUploadError(formatUploadClientError(err), 'proxy')
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
 * Safari: сначала прокси (XHR), потом прямой GCS.
 * Остальные браузеры: сначала прямой GCS, потом прокси.
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
  const proxyOpts = {
    fileId: opts.fileId,
    categorySlug: opts.categorySlug,
    folderId,
    file: opts.file,
    mime: opts.mime,
    fileName: opts.fileName,
  }

  const tryDirect = async () => {
    await putFileToGcsSignedUrl(opts.uploadUrl, opts.file, opts.mime)
    return 'direct' as const
  }
  const tryProxy = async () => {
    await putFileToGcsViaProxy(proxyOpts)
    return 'proxy' as const
  }

  if (typeof window !== 'undefined' && isSafari()) {
    try {
      return await tryProxy()
    } catch (proxyErr) {
      try {
        return await tryDirect()
      } catch (directErr) {
        const proxyMsg = formatUploadClientError(proxyErr)
        const directMsg = formatUploadClientError(directErr)
        throw new GcsUploadError(`${proxyMsg} (прямая: ${directMsg})`, 'proxy')
      }
    }
  }

  try {
    return await tryDirect()
  } catch (directErr) {
    try {
      return await tryProxy()
    } catch (proxyErr) {
      const directMsg = formatUploadClientError(directErr)
      const proxyMsg = formatUploadClientError(proxyErr)
      throw new GcsUploadError(`${proxyMsg} (прямая: ${directMsg})`, 'proxy')
    }
  }
}
