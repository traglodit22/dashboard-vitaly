import fs from 'fs'
import { promises as fsp } from 'fs'
import { Storage } from '@google-cloud/storage'
import { signGcsV4Url, type GcsSigningCredentials } from '@/lib/files/gcsSignedUrl'
import { MAX_FILE_BYTES, MAX_FILE_SIZE_ERROR, UPLOAD_TIMEOUT_MS } from '@/lib/files/types'

type ServiceAccountCredentials = GcsSigningCredentials & {
  project_id?: string
}

let cachedCredentials: { projectId: string; credentials: ServiceAccountCredentials } | null = null

function loadCredentials(): { projectId: string; credentials: ServiceAccountCredentials } {
  if (cachedCredentials) return cachedCredentials
  const credPath = process.env.GCS_CREDENTIALS_PATH?.trim()
  if (credPath && fs.existsSync(credPath)) {
    const parsed = JSON.parse(fs.readFileSync(credPath, 'utf8')) as ServiceAccountCredentials
    const projectId = parsed.project_id ?? process.env.GCS_PROJECT_ID?.trim()
    if (!projectId || !parsed.client_email || !parsed.private_key) {
      throw new Error('Некорректный файл ключей GCS')
    }
    cachedCredentials = { projectId, credentials: parsed }
    return cachedCredentials
  }

  const projectId = process.env.GCS_PROJECT_ID?.trim()
  const clientEmail = process.env.GCS_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Google Cloud Storage не настроен. Укажите GCS_BUCKET и GCS_CREDENTIALS_PATH (или GCS_PROJECT_ID, GCS_CLIENT_EMAIL, GCS_PRIVATE_KEY)',
    )
  }

  cachedCredentials = {
    projectId,
    credentials: { client_email: clientEmail, private_key: privateKey, project_id: projectId },
  }
  return cachedCredentials
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Подпись URL локально — без OAuth-запросов к Google (важно для VPS). */
export function getSigningStorage(): Storage {
  const { projectId, credentials } = loadCredentials()
  return new Storage({ projectId, credentials })
}

function isTransientGcsError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('premature close') ||
    msg.includes('invalid response body') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('timeout') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('abort')
  )
}

function gcsErrorMessage(err: unknown): string {
  if (isTransientGcsError(err)) {
    return 'Сбой соединения с Google Cloud. Попробуйте ещё раз через несколько секунд.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'Ошибка Google Cloud Storage'
}

async function withSignedUrlRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const attempts = 6
  const delays = [0, 500, 1500, 3000, 5000, 8000]
  let lastError: unknown

  for (let i = 0; i < attempts; i++) {
    if (delays[i]) await sleep(delays[i])
    try {
      return await fn()
    } catch (err) {
      lastError = err
      console.error(`[gcs] ${label} attempt ${i + 1}/${attempts} failed:`, err)
      if (!isTransientGcsError(err)) break
    }
  }

  throw new Error(gcsErrorMessage(lastError))
}

function signReadUrl(
  objectKey: string,
  opts?: { attachment?: boolean; fileName?: string; expiresMs?: number },
): string {
  const { credentials } = loadCredentials()
  const queryParams: Record<string, string> = {}
  if (opts?.attachment && opts.fileName) {
    const safe = opts.fileName.replace(/["\r\n]/g, '_')
    queryParams['response-content-disposition'] =
      `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(opts.fileName)}`
  }
  return signGcsV4Url({
    bucket: gcsBucketName(),
    objectKey,
    method: 'GET',
    expiresMs: opts?.expiresMs ?? Date.now() + 60 * 60 * 1000,
    queryParams: Object.keys(queryParams).length ? queryParams : undefined,
    credentials,
  })
}

/** Signed URL для прямой загрузки из браузера в GCS (обходит VPS→Google OAuth). */
export async function getGcsUploadSignedUrl(
  objectKey: string,
  contentType: string,
): Promise<string> {
  const { credentials } = loadCredentials()
  return signGcsV4Url({
    bucket: gcsBucketName(),
    objectKey,
    method: 'PUT',
    expiresMs: Date.now() + 20 * 60 * 1000,
    contentType,
    credentials,
  })
}

export async function getGcsReadSignedUrl(
  objectKey: string,
  opts?: { attachment?: boolean; fileName?: string },
): Promise<string> {
  return signReadUrl(objectKey, opts)
}

export function assertGcsSignedUploadUrl(uploadUrl: string): void {
  const u = new URL(uploadUrl)
  if (u.hostname !== 'storage.googleapis.com') {
    throw new Error('Некорректный URL загрузки')
  }
  const bucket = gcsBucketName()
  const prefix = `/${bucket}/`
  if (!decodeURIComponent(u.pathname).startsWith(prefix)) {
    throw new Error('Некорректный URL загрузки')
  }
}

type SignedUploadBody = Buffer | Blob | ReadableStream<Uint8Array>

function signedUploadHeaders(contentType: string, sizeBytes?: number): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': contentType }
  if (sizeBytes != null && sizeBytes >= 0) {
    headers['Content-Length'] = String(sizeBytes)
  }
  return headers
}

/** PUT через signed URL с сервера (без OAuth). */
export async function putBufferToSignedUrl(
  uploadUrl: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  assertGcsSignedUploadUrl(uploadUrl)
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(MAX_FILE_SIZE_ERROR)
  }
  await putBodyToSignedUrl(uploadUrl, buffer, contentType, buffer.length)
}

/** Потоковая загрузка в GCS — без буфера всего файла в памяти. */
export async function putBodyToSignedUrl(
  uploadUrl: string,
  body: SignedUploadBody,
  contentType: string,
  sizeBytes?: number,
): Promise<void> {
  assertGcsSignedUploadUrl(uploadUrl)
  if (sizeBytes != null && sizeBytes > MAX_FILE_BYTES) {
    throw new Error(MAX_FILE_SIZE_ERROR)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)
  try {
    const init: RequestInit & { duplex?: 'half' } = {
      method: 'PUT',
      body: body as BodyInit,
      headers: signedUploadHeaders(contentType, sizeBytes),
      signal: controller.signal,
    }
    if (body instanceof ReadableStream) {
      init.duplex = 'half'
    }
    const res = await fetch(uploadUrl, init)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(
        `Google Cloud отклонил загрузку (${res.status})${text ? `: ${text.slice(0, 160)}` : ''}`,
      )
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Таймаут загрузки в Google Cloud')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export function gcsBucketName(): string {
  const bucket = process.env.GCS_BUCKET?.trim()
  if (!bucket) throw new Error('GCS_BUCKET не задан')
  return bucket
}

export function isGcsConfigured(): boolean {
  const bucket = process.env.GCS_BUCKET?.trim()
  if (!bucket) return false

  const credPath = process.env.GCS_CREDENTIALS_PATH?.trim()
  if (credPath && fs.existsSync(credPath)) return true

  return Boolean(
    process.env.GCS_PROJECT_ID?.trim() &&
      process.env.GCS_CLIENT_EMAIL?.trim() &&
      process.env.GCS_PRIVATE_KEY?.trim(),
  )
}

export function gcsObjectKey(
  categorySlug: string,
  folderPrefix: string,
  fileId: string,
  ext: string,
): string {
  const mid = folderPrefix ? `${folderPrefix}/` : ''
  return `dashboard/${categorySlug}/${mid}${fileId}.${ext}`
}

export function gcsPreviewKey(
  categorySlug: string,
  folderPrefix: string,
  fileId: string,
): string {
  const mid = folderPrefix ? `${folderPrefix}/` : ''
  return `dashboard/${categorySlug}/${mid}${fileId}-preview.webp`
}

export function gcsFolderKeepKey(categorySlug: string, folderPrefix: string): string {
  return `dashboard/${categorySlug}/${folderPrefix}/.keep`
}

/** Загрузка в GCS через signed URL (без OAuth SDK). */
export async function uploadToGcs(
  objectKey: string,
  buffer: Buffer,
  mime: string,
): Promise<void> {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(MAX_FILE_SIZE_ERROR)
  }
  await withSignedUrlRetry(`upload ${objectKey}`, async () => {
    const uploadUrl = await getGcsUploadSignedUrl(objectKey, mime)
    await putBufferToSignedUrl(uploadUrl, buffer, mime)
  })
}

/** Загрузка локального файла в GCS (без лимита 50 МБ для больших бэкапов). */
export async function uploadLocalFileToGcs(
  objectKey: string,
  filePath: string,
  mime: string,
): Promise<number> {
  const stat = await fsp.stat(filePath)
  if (stat.size <= MAX_FILE_BYTES) {
    const buffer = await fsp.readFile(filePath)
    await uploadToGcs(objectKey, buffer, mime)
    return stat.size
  }

  await withSignedUrlRetry(`upload file ${objectKey}`, async () => {
    const storage = getSigningStorage()
    await storage.bucket(gcsBucketName()).upload(filePath, {
      destination: objectKey,
      metadata: { contentType: mime },
      resumable: true,
    })
  })
  return stat.size
}

/** Скачивание из GCS через signed URL (без OAuth SDK). */
export async function downloadFromGcs(objectKey: string): Promise<Buffer> {
  return withSignedUrlRetry(`download ${objectKey}`, async () => {
    const url = await getGcsReadSignedUrl(objectKey)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 60_000)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) {
        throw new Error(`Не удалось скачать из Google Cloud (${res.status})`)
      }
      return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Таймаут чтения из Google Cloud')
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  })
}

export async function deleteFromGcs(objectKey: string): Promise<void> {
  await withSignedUrlRetry(`delete ${objectKey}`, async () => {
    const { credentials } = loadCredentials()
    const url = signGcsV4Url({
      bucket: gcsBucketName(),
      objectKey,
      method: 'DELETE',
      expiresMs: Date.now() + 15 * 60 * 1000,
      credentials,
    })
    const res = await fetch(url, { method: 'DELETE' })
    if (!res.ok && res.status !== 404) {
      throw new Error(`Не удалось удалить из Google Cloud (${res.status})`)
    }
  })
}

/** Проверка: ключи есть, подпись URL работает. */
export async function pingGcs(): Promise<boolean> {
  if (!isGcsConfigured()) return false
  try {
    signReadUrl(gcsObjectKey('_ping', '', 'test', 'txt'), { expiresMs: Date.now() + 60_000 })
    return true
  } catch {
    return false
  }
}
