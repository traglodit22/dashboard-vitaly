import fs from 'fs'
import { GoogleAuth } from 'google-auth-library'
import { Storage } from '@google-cloud/storage'
import { MAX_FILE_BYTES, MAX_FILE_SIZE_ERROR, UPLOAD_TIMEOUT_MS } from '@/lib/files/types'

const GCS_SCOPES = ['https://www.googleapis.com/auth/devstorage.read_write']

const GCS_RETRY_OPTIONS = {
  autoRetry: true,
  maxRetries: 8,
  retryDelayMultiplier: 2,
  totalTimeout: 180,
  maxRetryDelay: 64,
} as const

let storagePromise: Promise<Storage> | null = null

type ServiceAccountCredentials = {
  project_id?: string
  client_email: string
  private_key: string
}

function loadCredentials(): { projectId: string; credentials: ServiceAccountCredentials } {
  const credPath = process.env.GCS_CREDENTIALS_PATH?.trim()
  if (credPath && fs.existsSync(credPath)) {
    const parsed = JSON.parse(fs.readFileSync(credPath, 'utf8')) as ServiceAccountCredentials
    const projectId = parsed.project_id ?? process.env.GCS_PROJECT_ID?.trim()
    if (!projectId || !parsed.client_email || !parsed.private_key) {
      throw new Error('Некорректный файл ключей GCS')
    }
    return { projectId, credentials: parsed }
  }

  const projectId = process.env.GCS_PROJECT_ID?.trim()
  const clientEmail = process.env.GCS_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Google Cloud Storage не настроен. Укажите GCS_BUCKET и GCS_CREDENTIALS_PATH (или GCS_PROJECT_ID, GCS_CLIENT_EMAIL, GCS_PRIVATE_KEY)',
    )
  }

  return {
    projectId,
    credentials: { client_email: clientEmail, private_key: privateKey, project_id: projectId },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function invalidateStorageClient(): void {
  storagePromise = null
}

async function buildStorageClient(): Promise<Storage> {
  if (!process.env.GCS_BUCKET?.trim()) {
    throw new Error('GCS_BUCKET не задан')
  }

  const { projectId, credentials } = loadCredentials()
  const auth = new GoogleAuth({
    credentials,
    projectId,
    scopes: GCS_SCOPES,
    clientOptions: {
      transporterOptions: {
        timeout: 30_000,
      },
    },
  })

  return new Storage({
    authClient: auth,
    projectId,
    retryOptions: GCS_RETRY_OPTIONS,
  })
}

/** Подпись URL локально — без OAuth-запросов к Google. */
function getSigningStorage(): Storage {
  const { projectId, credentials } = loadCredentials()
  return new Storage({ projectId, credentials })
}

/** Signed URL для прямой загрузки из браузера в GCS (обходит VPS→Google). */
export async function getGcsUploadSignedUrl(
  objectKey: string,
  contentType: string,
): Promise<string> {
  const storage = getSigningStorage()
  const [url] = await storage.bucket(gcsBucketName()).file(objectKey).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 20 * 60 * 1000,
    contentType,
  })
  return url
}

export async function getGcsReadSignedUrl(objectKey: string): Promise<string> {
  const storage = getSigningStorage()
  const [url] = await storage.bucket(gcsBucketName()).file(objectKey).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  })
  return url
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

/** PUT через signed URL с сервера (обходит CORS браузера). */
export async function putBufferToSignedUrl(
  uploadUrl: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  assertGcsSignedUploadUrl(uploadUrl)
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(MAX_FILE_SIZE_ERROR)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)
  try {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      body: new Uint8Array(buffer),
      headers: { 'Content-Type': contentType },
      signal: controller.signal,
    })
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

async function getStorage(): Promise<Storage> {
  if (!storagePromise) {
    storagePromise = buildStorageClient().catch((err) => {
      storagePromise = null
      throw err
    })
  }
  return storagePromise
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
    msg.includes('502')
  )
}

function gcsErrorMessage(err: unknown): string {
  if (isTransientGcsError(err)) {
    return 'Сбой соединения с Google Cloud. Попробуйте ещё раз через несколько секунд.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'Ошибка Google Cloud Storage'
}

async function withGcsRetry<T>(label: string, fn: (storage: Storage) => Promise<T>): Promise<T> {
  const attempts = 6
  const delays = [0, 1500, 3000, 5000, 8000, 12000]
  let lastError: unknown

  for (let i = 0; i < attempts; i++) {
    if (delays[i]) await sleep(delays[i])
    try {
      const client = await getStorage()
      return await fn(client)
    } catch (err) {
      lastError = err
      console.error(`[gcs] ${label} attempt ${i + 1}/${attempts} failed:`, err)
      if (isTransientGcsError(err)) {
        invalidateStorageClient()
        continue
      }
      break
    }
  }

  throw new Error(gcsErrorMessage(lastError))
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

export async function uploadToGcs(
  objectKey: string,
  buffer: Buffer,
  mime: string,
): Promise<void> {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(MAX_FILE_SIZE_ERROR)
  }
  await withGcsRetry(`upload ${objectKey}`, async (client) => {
    await client.bucket(gcsBucketName()).file(objectKey).save(buffer, {
      contentType: mime,
      resumable: false,
      validation: false,
      metadata: { cacheControl: 'private, max-age=3600' },
    })
  })
}

export async function downloadFromGcs(objectKey: string): Promise<Buffer> {
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
}

export async function deleteFromGcs(objectKey: string): Promise<void> {
  await withGcsRetry(`delete ${objectKey}`, async (client) => {
    await client.bucket(gcsBucketName()).file(objectKey).delete({ ignoreNotFound: true })
  })
}

/** Проверка доступа к bucket (для диагностики). */
export async function pingGcs(): Promise<boolean> {
  if (!isGcsConfigured()) return false
  await withGcsRetry('ping', async (client) => {
    await client.bucket(gcsBucketName()).getMetadata()
  })
  return true
}
