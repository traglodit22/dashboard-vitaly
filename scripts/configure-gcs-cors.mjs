#!/usr/bin/env node
/**
 * Настройка CORS на GCS bucket для прямой загрузки из браузера.
 * Запуск на VPS: node scripts/configure-gcs-cors.mjs
 */
import fs from 'fs'
import { Storage } from '@google-cloud/storage'

function loadConfig() {
  const bucket = process.env.GCS_BUCKET?.trim()
  if (!bucket) throw new Error('GCS_BUCKET не задан')

  const credPath = process.env.GCS_CREDENTIALS_PATH?.trim()
  if (credPath && fs.existsSync(credPath)) {
    const parsed = JSON.parse(fs.readFileSync(credPath, 'utf8'))
    return {
      bucket,
      storage: new Storage({
        projectId: parsed.project_id ?? process.env.GCS_PROJECT_ID,
        credentials: parsed,
      }),
    }
  }

  const projectId = process.env.GCS_PROJECT_ID?.trim()
  const clientEmail = process.env.GCS_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('GCS credentials not configured')
  }

  return {
    bucket,
    storage: new Storage({
      projectId,
      credentials: { client_email: clientEmail, private_key: privateKey },
    }),
  }
}

const origins = (process.env.GCS_CORS_ORIGINS ?? 'http://135.106.161.215,https://plansolo.ru')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const cors = [
  {
    origin: origins,
    method: ['GET', 'PUT', 'HEAD', 'OPTIONS'],
    responseHeader: ['Content-Type', 'Content-Length', 'x-goog-resumable'],
    maxAgeSeconds: 3600,
  },
]

const { bucket, storage } = loadConfig()
await storage.bucket(bucket).setCorsConfiguration(cors)
console.log(`CORS configured for bucket "${bucket}":`, origins)
