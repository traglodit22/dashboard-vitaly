import fs from 'fs'
import { Storage } from '@google-cloud/storage'
import { MAX_FILE_BYTES } from '@/lib/files/types'

let storage: Storage | null = null

const GCS_RETRY_OPTIONS = {
  autoRetry: true,
  maxRetries: 5,
  retryDelayMultiplier: 2,
  totalTimeout: 120,
  maxRetryDelay: 32,
} as const

function loadKeyFileCredentials(credPath: string): { projectId?: string; credentials: object } {
  const raw = fs.readFileSync(credPath, 'utf8')
  const parsed = JSON.parse(raw) as {
    project_id?: string
    client_email?: string
    private_key?: string
  }
  return {
    projectId: parsed.project_id ?? process.env.GCS_PROJECT_ID?.trim(),
    credentials: parsed,
  }
}

function getStorage(): Storage {
  if (storage) return storage

  const bucket = process.env.GCS_BUCKET?.trim()
  const credPath = process.env.GCS_CREDENTIALS_PATH?.trim()

  if (credPath && fs.existsSync(credPath)) {
    const { projectId, credentials } = loadKeyFileCredentials(credPath)
    storage = new Storage({
      projectId,
      credentials,
      retryOptions: GCS_RETRY_OPTIONS,
    })
    return storage
  }

  const projectId = process.env.GCS_PROJECT_ID?.trim()
  const clientEmail = process.env.GCS_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()

  if (!projectId || !clientEmail || !privateKey || !bucket) {
    throw new Error(
      'Google Cloud Storage не настроен. Укажите GCS_BUCKET и GCS_CREDENTIALS_PATH (или GCS_PROJECT_ID, GCS_CLIENT_EMAIL, GCS_PRIVATE_KEY)',
    )
  }

  storage = new Storage({
    projectId,
    credentials: { client_email: clientEmail, private_key: privateKey },
    retryOptions: GCS_RETRY_OPTIONS,
  })
  return storage
}

function isTransientGcsError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('premature close') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('fetch failed')
  )
}

function gcsErrorMessage(err: unknown): string {
  if (isTransientGcsError(err)) {
    return 'Сбой соединения с Google Cloud. Попробуйте ещё раз через несколько секунд.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'Ошибка Google Cloud Storage'
}

async function withGcsRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const attempts = 3
  let lastError: unknown

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      console.error(`[gcs] ${label} attempt ${i + 1}/${attempts} failed:`, err)
      if (!isTransientGcsError(err) || i === attempts - 1) break
      await new Promise((r) => setTimeout(r, 800 * (i + 1)))
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
  await withGcsRetry(`upload ${objectKey}`, async () => {
    const bucket = getStorage().bucket(gcsBucketName())
    await bucket.file(objectKey).save(buffer, {
      contentType: mime,
      resumable: false,
      metadata: { cacheControl: 'private, max-age=3600' },
    })
  })
}

export async function downloadFromGcs(objectKey: string): Promise<Buffer> {
  return withGcsRetry(`download ${objectKey}`, async () => {
    const bucket = getStorage().bucket(gcsBucketName())
    const [buf] = await bucket.file(objectKey).download()
    return buf
  })
}

export async function deleteFromGcs(objectKey: string): Promise<void> {
  await withGcsRetry(`delete ${objectKey}`, async () => {
    const bucket = getStorage().bucket(gcsBucketName())
    await bucket.file(objectKey).delete({ ignoreNotFound: true })
  })
}

/** Проверка доступа к bucket (для диагностики). */
export async function pingGcs(): Promise<boolean> {
  if (!isGcsConfigured()) return false
  await withGcsRetry('ping', async () => {
    await getStorage().bucket(gcsBucketName()).getMetadata()
  })
  return true
}
