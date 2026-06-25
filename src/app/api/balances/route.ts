import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'

export const runtime = 'nodejs'

function rowToProvider(row: Record<string, unknown>) {
  const hasApiKey = Boolean((row.api_key as string | null)?.trim())
  return {
    id: row.id as string,
    name: row.name as string,
    apiUrl: row.api_url as string,
    panelUrl: (row.panel_url as string) ?? '',
    hasApiKey,
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

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM balance_providers ORDER BY name ASC',
  )
  return NextResponse.json({ providers: rows.map(rowToProvider) })
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const body = await req.json()

  const rows = await query<Record<string, unknown>>(
    `INSERT INTO balance_providers
      (name, api_url, panel_url, api_key, api_header_name, response_path, currency, threshold, active, extra_params, response_type, request_method, key_param_name, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      String(body.name ?? '').trim(),
      String(body.apiUrl ?? '').trim(),
      String(body.panelUrl ?? '').trim(),
      String(body.apiKey ?? '').trim(),
      String(body.apiHeaderName ?? 'Authorization').trim(),
      String(body.responsePath ?? 'balance').trim(),
      String(body.currency ?? 'RUB').trim(),
      Number(body.threshold ?? 1000),
      body.active !== false,
      typeof body.extraParams === 'string' ? body.extraParams.trim() : 'action=balance',
      typeof body.responseType === 'string' && ['json', 'text'].includes(body.responseType) ? body.responseType : 'json',
      typeof body.requestMethod === 'string' && ['POST','GET'].includes(body.requestMethod.toUpperCase()) ? body.requestMethod.toUpperCase() : 'POST',
      typeof body.keyParamName === 'string' ? body.keyParamName.trim() : 'key',
      new Date().toISOString(),
    ],
  )

  return NextResponse.json({ provider: rowToProvider(rows[0]) }, { status: 201 })
}
