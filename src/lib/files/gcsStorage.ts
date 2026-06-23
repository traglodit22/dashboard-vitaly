import fs from 'fs'
import { GoogleAuth } from 'google-auth-library'
import { Storage } from '@google-cloud/storage'
import { MAX_FILE_BYTES } from '@/lib/files/types'

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

async function warmAuthToken(auth: GoogleAuth): Promise<void> {
  const attempts = 5
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const token = await auth.getAccessToken()
      if (token) return
      throw new Error('Пустой токен GCS')
    } catch (err) {
      lastError = err
      console.error(`[gcs] auth token attempt ${i + 1}/${attempts} failed:`, err)
      if (i < attempts - 1) await sleep(1200 * (i + 1))
    }
  }
  throw lastError
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
        timeout: 90_000,
      },
    },
  })

  await warmAuthToken(auth)

  return new Storage({
    authClient: auth,
    projectId,
    retryOptions: GCS_RETRY_OPTIONS,
  })
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
    throw new Error('Максимальный размер файла — 20 МБ')
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
  return withGcsRetry(`download ${objectKey}`, async (client) => {
    const [buf] = await client.bucket(gcsBucketName()).file(objectKey).download()
    return buf
  })
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
