import { query } from '@/lib/db/index'
import { DOBROPOST } from './constants'
import type { ShipmentCreatePayload, ShipmentResponse, ShipmentListResponse } from './types'

const TOKEN_TTL_MS = 11 * 60 * 60 * 1000 // 11 hours — refresh before 12h server expiry

interface CachedToken {
  token: string
  expiresAt: number // unix ms
}

// Креды берём из system_settings, фоллбэк — env.
async function getCredentials(): Promise<{ email: string; password: string }> {
  const rows = await query<{ dobropost_email: string | null; dobropost_password: string | null }>(
    'SELECT dobropost_email, dobropost_password FROM system_settings WHERE id = 1',
  )
  const row = rows[0]
  const email = row?.dobropost_email || process.env.DOBROPOST_EMAIL
  const password = row?.dobropost_password || process.env.DOBROPOST_PASSWORD
  if (!email || !password) {
    throw new Error('Креды ДоброПост не заданы — укажите их в Настройках')
  }
  return { email, password }
}

async function signIn(): Promise<CachedToken> {
  const { email, password } = await getCredentials()
  const res = await fetch(`${DOBROPOST.apiUrl}/api/shipment/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw new Error(`DobroPost sign-in failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { token: string }
  const fresh: CachedToken = { token: data.token, expiresAt: Date.now() + TOKEN_TTL_MS }

  await query(
    'UPDATE system_settings SET dobropost_token = $1, dobropost_token_expires_at = $2 WHERE id = 1',
    [fresh.token, fresh.expiresAt],
  )

  return fresh
}

async function getToken(): Promise<string> {
  const rows = await query<{
    dobropost_token: string | null
    dobropost_token_expires_at: string | null
  }>('SELECT dobropost_token, dobropost_token_expires_at FROM system_settings WHERE id = 1')
  const row = rows[0]
  const token = row?.dobropost_token
  const expiresAt = row?.dobropost_token_expires_at ? Number(row.dobropost_token_expires_at) : 0
  if (token && expiresAt > Date.now()) return token
  return (await signIn()).token
}

// Запрос с авторизацией; при 401 один раз переполучаем токен и повторяем.
async function authedFetch(path: string, init: RequestInit): Promise<Response> {
  const send = (token: string) =>
    fetch(`${DOBROPOST.apiUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
    })

  let res = await send(await getToken())
  if (res.status === 401) {
    res = await send((await signIn()).token)
  }
  return res
}

export async function createShipment(payload: ShipmentCreatePayload): Promise<ShipmentResponse> {
  const res = await authedFetch('/api/shipment', { method: 'POST', body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(`createShipment failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function getShipments(params?: {
  page?: number
  offset?: number
  statusId?: number
}): Promise<ShipmentListResponse> {
  const qs = new URLSearchParams()
  if (params?.page != null) qs.set('page', String(params.page))
  if (params?.offset != null) qs.set('offset', String(params.offset))
  if (params?.statusId != null) qs.set('statusId', String(params.statusId))
  const res = await authedFetch(`/api/shipment?${qs.toString()}`, { method: 'GET' })
  if (!res.ok) throw new Error(`getShipments failed: ${res.status} ${await res.text()}`)
  return res.json()
}

// Актуальные статусы (+ вес, если уже проставлен складом) по списку shipmentId.
// Отдельного GET по id у ДоброПост нет, поэтому листаем список (offset-пагинация),
// пока не найдём все нужные id, не кончится content или не упрёмся в лимит страниц.
export async function getShipmentStatuses(
  shipmentIds: number[],
): Promise<Map<number, { id: number; name: string; weightKg: number | null }>> {
  const wanted = new Set(shipmentIds)
  const found = new Map<number, { id: number; name: string; weightKg: number | null }>()
  if (wanted.size === 0) return found

  const PAGE_SIZE = 100
  for (let page = 1; page <= 50 && found.size < wanted.size; page++) {
    const { content } = await getShipments({ page, offset: PAGE_SIZE })
    if (!content?.length) break
    for (const s of content) {
      if (wanted.has(s.id) && s.status) {
        const weightKg = s.totalWeightKG > 0 ? s.totalWeightKG : null
        found.set(s.id, { id: s.status.id, name: s.status.name, weightKg })
      }
    }
    if (content.length < PAGE_SIZE) break
  }
  return found
}

export async function updateShipment(payload: ShipmentCreatePayload): Promise<ShipmentResponse> {
  const res = await authedFetch('/api/shipment', { method: 'PUT', body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(`updateShipment failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function deleteShipment(id: number): Promise<void> {
  const res = await authedFetch(`/api/shipment/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteShipment failed: ${res.status} ${await res.text()}`)
}
