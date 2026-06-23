import { Storage } from '@google-cloud/storage'
import { MAX_FILE_BYTES } from '@/lib/files/types'

let storage: Storage | null = null

function getStorage(): Storage {
  if (storage) return storage

  const projectId = process.env.GCS_PROJECT_ID?.trim()
  const clientEmail = process.env.GCS_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()
  const bucket = process.env.GCS_BUCKET?.trim()

  if (!projectId || !clientEmail || !privateKey || !bucket) {
    throw new Error(
      'Google Cloud Storage не настроен. Укажите GCS_PROJECT_ID, GCS_CLIENT_EMAIL, GCS_PRIVATE_KEY и GCS_BUCKET в .env',
    )
  }

  storage = new Storage({
    projectId,
    credentials: { client_email: clientEmail, private_key: privateKey },
  })
  return storage
}

export function gcsBucketName(): string {
  const bucket = process.env.GCS_BUCKET?.trim()
  if (!bucket) throw new Error('GCS_BUCKET не задан')
  return bucket
}

export function isGcsConfigured(): boolean {
  return Boolean(
    process.env.GCS_PROJECT_ID?.trim() &&
      process.env.GCS_CLIENT_EMAIL?.trim() &&
      process.env.GCS_PRIVATE_KEY?.trim() &&
      process.env.GCS_BUCKET?.trim(),
  )
}

export function gcsObjectKey(categorySlug: string, fileId: string, ext: string): string {
  return `dashboard/${categorySlug}/${fileId}.${ext}`
}

export function gcsPreviewKey(categorySlug: string, fileId: string): string {
  return `dashboard/${categorySlug}/${fileId}-preview.webp`
}

export async function uploadToGcs(
  objectKey: string,
  buffer: Buffer,
  mime: string,
): Promise<void> {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error('Максимальный размер файла — 20 МБ')
  }
  const bucket = getStorage().bucket(gcsBucketName())
  await bucket.file(objectKey).save(buffer, {
    contentType: mime,
    resumable: false,
    metadata: { cacheControl: 'private, max-age=3600' },
  })
}

export async function downloadFromGcs(objectKey: string): Promise<Buffer> {
  const bucket = getStorage().bucket(gcsBucketName())
  const [buf] = await bucket.file(objectKey).download()
  return buf
}

export async function deleteFromGcs(objectKey: string): Promise<void> {
  const bucket = getStorage().bucket(gcsBucketName())
  await bucket.file(objectKey).delete({ ignoreNotFound: true })
}
