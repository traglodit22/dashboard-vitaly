#!/usr/bin/env node
/**
 * Настройка CORS на GCS bucket для прямой загрузки из браузера.
 * Использует локальную подпись JWT — без @google-cloud/storage OAuth.
 * Запуск: node scripts/configure-gcs-cors.mjs
 */
import crypto from 'crypto'
import fs from 'fs'

function loadCredentials() {
  const bucket = process.env.GCS_BUCKET?.trim()
  if (!bucket) throw new Error('GCS_BUCKET не задан')

  const credPath = process.env.GCS_CREDENTIALS_PATH?.trim()
  if (credPath && fs.existsSync(credPath)) {
    const parsed = JSON.parse(fs.readFileSync(credPath, 'utf8'))
    return { bucket, credentials: parsed }
  }

  const projectId = process.env.GCS_PROJECT_ID?.trim()
  const clientEmail = process.env.GCS_CLIENT_EMAIL?.trim()
  const privateKey = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('GCS credentials not configured')
  }

  return {
    bucket,
    credentials: { project_id: projectId, client_email: clientEmail, private_key: privateKey },
  }
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/devstorage.full_control',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const unsigned = `${header}.${payload}`
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .sign(credentials.private_key, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const jwt = `${unsigned}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OAuth token failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.access_token
}

const origins = (process.env.GCS_CORS_ORIGINS ??
  'http://135.106.161.215,https://135.106.161.215,http://plansolo.ru,https://plansolo.ru,https://www.plansolo.ru')
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

const { bucket, credentials } = loadCredentials()
const token = await getAccessToken(credentials)

const patchRes = await fetch(
  `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}?fields=cors`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cors }),
  },
)

if (!patchRes.ok) {
  const text = await patchRes.text().catch(() => '')
  throw new Error(`CORS patch failed (${patchRes.status}): ${text.slice(0, 300)}`)
}

console.log(`CORS configured for bucket "${bucket}":`, origins)
