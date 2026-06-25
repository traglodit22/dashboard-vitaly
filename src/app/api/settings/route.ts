import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'

export const runtime = 'nodejs'

// Пароль ДоброПост наружу не отдаём — только email и флаг «настроено».
export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM system_settings WHERE id = 1',
  )
  const s = rows[0] ?? {}

  return NextResponse.json({
    dobropostEmail: (s.dobropost_email as string) ?? '',
    dobropostConfigured: Boolean(s.dobropost_password),
    autoCheckEnabled: Boolean(s.auto_check_enabled),
    autoCheckIntervalHours: (s.auto_check_interval_hours as number) ?? 12,
    autoCheckLastRunAt: (s.auto_check_last_run_at as string) ?? null,
    telegramNotifyEnabled: Boolean(s.telegram_notify_enabled),
    telegramNotifyChatIds: Array.isArray(s.telegram_notify_chat_ids)
      ? (s.telegram_notify_chat_ids as string[])
      : [],
    telegramBotConfigured: Boolean(s.telegram_bot_token),
    deepseekConfigured: Boolean(s.deepseek_api_key),
    siteTitle: (s.site_title as string) ?? '',
    hasFavicon: Boolean(s.favicon_base64),
    navSectionOrder: Array.isArray(s.nav_section_order)
      ? (s.nav_section_order as string[])
      : [],
  })
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const body = await req.json()

  // Build dynamic SET clause only for fields present in the request body.
  const setClauses: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (typeof body.dobropostEmail === 'string') {
    setClauses.push(`dobropost_email = $${idx++}`)
    values.push(body.dobropostEmail.trim())
  }
  // Пароль перезаписываем только если прислан непустой (пустой = «оставить как есть»).
  if (typeof body.dobropostPassword === 'string' && body.dobropostPassword.trim()) {
    setClauses.push(`dobropost_password = $${idx++}`)
    values.push(body.dobropostPassword.trim())
  }
  if (typeof body.autoCheckEnabled === 'boolean') {
    setClauses.push(`auto_check_enabled = $${idx++}`)
    values.push(body.autoCheckEnabled)
  }
  if (typeof body.autoCheckIntervalHours === 'number') {
    setClauses.push(`auto_check_interval_hours = $${idx++}`)
    values.push(body.autoCheckIntervalHours)
  }
  if (typeof body.telegramNotifyEnabled === 'boolean') {
    setClauses.push(`telegram_notify_enabled = $${idx++}`)
    values.push(body.telegramNotifyEnabled)
  }
  if (Array.isArray(body.telegramNotifyChatIds)) {
    const ids = (body.telegramNotifyChatIds as unknown[])
      .filter((id) => typeof id === 'string' && (id as string).trim())
      .map((id) => (id as string).trim())
    setClauses.push(`telegram_notify_chat_ids = $${idx++}`)
    values.push(ids)
  }
  if (typeof body.telegramBotToken === 'string' && body.telegramBotToken.trim()) {
    setClauses.push(`telegram_bot_token = $${idx++}`)
    values.push(body.telegramBotToken.trim())
  }
  if (typeof body.deepseekApiKey === 'string' && body.deepseekApiKey.trim()) {
    setClauses.push(`deepseek_api_key = $${idx++}`)
    values.push(body.deepseekApiKey.trim())
  }
  if (typeof body.siteTitle === 'string') {
    setClauses.push(`site_title = $${idx++}`)
    values.push(body.siteTitle.trim())
  }
  if (typeof body.faviconBase64 === 'string' && body.faviconBase64.trim()) {
    setClauses.push(`favicon_base64 = $${idx++}`)
    values.push(body.faviconBase64.trim())
  }
  if (body.removeFavicon === true) {
    setClauses.push(`favicon_base64 = $${idx++}`)
    values.push(null)
  }
  if (Array.isArray(body.navSectionOrder)) {
    const { saveNavSectionOrder } = await import('@/lib/navigation/navOrder')
    const saved = await saveNavSectionOrder(body.navSectionOrder)
    setClauses.push(`nav_section_order = $${idx++}`)
    values.push(saved)
  }

  if (setClauses.length > 0) {
    values.push(new Date().toISOString())
    await query(
      `UPDATE system_settings SET ${setClauses.join(', ')}, updated_at = $${idx} WHERE id = 1`,
      values,
    )
  }

  return NextResponse.json({ ok: true })
}
