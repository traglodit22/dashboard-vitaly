import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { parseEmployeeBody, validateEmployee } from '@/lib/salaries/validation'
import type { Employee } from '@/types'

export const runtime = 'nodejs'

function rowToEmployee(row: Record<string, unknown>): Employee {
  return {
    id: row.id as string,
    name: row.name as string,
    role: (row.role as string) ?? '',
    hourlyRate: Number(row.hourly_rate),
    trackerEmail: (row.tracker_email as string) ?? '',
    telegramId: (row.telegram_id as string) ?? undefined,
    active: Boolean(row.active),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

// Редактирование сотрудника. Поддерживает переключение active (архив/восстановление):
// если в теле есть только { active }, меняем лишь его, без валидации остальных полей.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const { id } = await params

  const existing = await query<Record<string, unknown>>(
    'SELECT * FROM employees WHERE id = $1',
    [id],
  )
  if (existing.length === 0) return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 })

  const body = await req.json()

  // Только переключение архива.
  const keys = Object.keys(body)
  if (keys.length === 1 && keys[0] === 'active') {
    const rows = await query<Record<string, unknown>>(
      'UPDATE employees SET active = $1 WHERE id = $2 RETURNING *',
      [Boolean(body.active), id],
    )
    return NextResponse.json({ employee: rowToEmployee(rows[0]) })
  }

  const fields = parseEmployeeBody(body)
  const errors = validateEmployee(fields)
  if (errors.length) return NextResponse.json({ errors }, { status: 400 })

  const rows = await query<Record<string, unknown>>(
    `UPDATE employees SET
      name = $1,
      role = $2,
      hourly_rate = $3,
      tracker_email = $4,
      telegram_id = $5
    WHERE id = $6 RETURNING *`,
    [
      fields.name,
      fields.role,
      fields.hourlyRate,
      fields.trackerEmail,
      fields.telegramId ?? null,
      id,
    ],
  )

  return NextResponse.json({ employee: rowToEmployee(rows[0]) })
}

// Архивирование (мягкое удаление). Историю начислений не трогаем.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const { id } = await params
  await query('UPDATE employees SET active = false WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
