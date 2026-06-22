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

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM employees ORDER BY created_at ASC',
  )
  const employees = rows.map(rowToEmployee)
  return NextResponse.json({ employees })
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const body = await req.json()
  const fields = parseEmployeeBody(body)

  const errors = validateEmployee(fields)
  if (errors.length) return NextResponse.json({ errors }, { status: 400 })

  const now = new Date().toISOString()
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO employees (name, role, hourly_rate, tracker_email, telegram_id, active, created_at)
     VALUES ($1, $2, $3, $4, $5, true, $6)
     RETURNING *`,
    [
      fields.name,
      fields.role,
      fields.hourlyRate,
      fields.trackerEmail,
      fields.telegramId ?? null,
      now,
    ],
  )

  return NextResponse.json({ employee: rowToEmployee(rows[0]) })
}
