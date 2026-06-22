import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'

export const runtime = 'nodejs'

function rowToProvider(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    apiUrl: row.api_url as string,
    panelUrl: (row.panel_url as string) ?? '',
    apiKey: (row.api_key as string) ?? '',
    apiHeaderName: (row.api_header_name as string) ?? 'Authorization',
    currency: (row.currency as string) ?? 'RUB',
    threshold: Number(row.threshold),
    lastBalance: row.last_balance != null ? Number(row.last_balance) : null,
    lastCheckedAt:
      row.last_checked_at instanceof Date
        ? row.last_checked_at.toISOString()
        : (row.last_checked_at as string) ?? null,
    lastError: (row.last_error as string) ?? null,
    active: Boolean(row.active),
    extraParams: (row.extra_params as string) ?? 'action=balance',
    responseType: (row.response_type as string) ?? 'json',
    responsePath: (row.response_path as string) ?? 'balance',
    requestMethod: (row.request_method as string) ?? 'POST',
    keyParamName: (row.key_param_name as string) ?? 'key',
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  const body = await req.json()

  const setClauses: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (typeof body.name === 'string') {
    setClauses.push(`name = $${idx++}`)
    values.push(body.name.trim())
  }
  if (typeof body.apiUrl === 'string') {
    setClauses.push(`api_url = $${idx++}`)
    values.push(body.apiUrl.trim())
  }
  if (typeof body.panelUrl === 'string') {
    setClauses.push(`panel_url = $${idx++}`)
    values.push(body.panelUrl.trim())
  }
  if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
    setClauses.push(`api_key = $${idx++}`)
    values.push(body.apiKey.trim())
  }
  if (typeof body.apiHeaderName === 'string') {
    setClauses.push(`api_header_name = $${idx++}`)
    values.push(body.apiHeaderName.trim())
  }
  if (typeof body.currency === 'string') {
    setClauses.push(`currency = $${idx++}`)
    values.push(body.currency.trim())
  }
  if (typeof body.threshold === 'number') {
    setClauses.push(`threshold = $${idx++}`)
    values.push(body.threshold)
  }
  if (typeof body.active === 'boolean') {
    setClauses.push(`active = $${idx++}`)
    values.push(body.active)
  }
  if (typeof body.extraParams === 'string') {
    setClauses.push(`extra_params = $${idx++}`)
    values.push(body.extraParams.trim())
  }
  if (typeof body.responseType === 'string' && ['json', 'text'].includes(body.responseType)) {
    setClauses.push(`response_type = $${idx++}`)
    values.push(body.responseType)
  }
  if (typeof body.responsePath === 'string') {
    setClauses.push(`response_path = $${idx++}`)
    values.push(body.responsePath.trim())
  }
  if (typeof body.requestMethod === 'string' && ['POST', 'GET'].includes(body.requestMethod.toUpperCase())) {
    setClauses.push(`request_method = $${idx++}`)
    values.push(body.requestMethod.toUpperCase())
  }
  if (typeof body.keyParamName === 'string') {
    setClauses.push(`key_param_name = $${idx++}`)
    values.push(body.keyParamName.trim())
  }

  if (!setClauses.length) {
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
  }

  values.push(id)
  const rows = await query<Record<string, unknown>>(
    `UPDATE balance_providers SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  )

  if (!rows.length) {
    return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  }

  return NextResponse.json({ provider: rowToProvider(rows[0]) })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  await query('DELETE FROM balance_providers WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
