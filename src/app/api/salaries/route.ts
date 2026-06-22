import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { computeTotal, isValidMonth, salaryRecordId } from '@/lib/salaries/calc'
import type { SalaryRecord } from '@/types'

export const runtime = 'nodejs'

function rowToSalaryRecord(row: Record<string, unknown>): SalaryRecord {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    month: row.month as string,
    hours: Number(row.hours),
    hourlyRate: Number(row.hourly_rate),
    bonuses: Number(row.bonuses),
    deductions: Number(row.deductions),
    total: Number(row.total),
    paid: Boolean(row.paid),
    paidAt: row.paid_at instanceof Date ? row.paid_at.toISOString() : (row.paid_at as string) ?? null,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  }
}

// GET /api/salaries?month=YYYY-MM — начисления за месяц.
export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const month = new URL(req.url).searchParams.get('month')
  if (!isValidMonth(month)) {
    return NextResponse.json({ error: 'Некорректный месяц' }, { status: 400 })
  }
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM salary_records WHERE month = $1',
    [month],
  )
  const records = rows.map(rowToSalaryRecord)
  return NextResponse.json({ records })
}

interface IncomingRow {
  employeeId: string
  hours: number
  hourlyRate: number
  bonuses: number
  deductions: number
  paid: boolean
}

// POST /api/salaries — upsert ведомости за месяц. Тело: { month, rows: IncomingRow[] }.
// paidAt выставляется при переходе paid false→true и обнуляется при снятии.
export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const body = await req.json()
  const { month, rows } = body as { month?: string; rows?: IncomingRow[] }
  if (!isValidMonth(month)) {
    return NextResponse.json({ error: 'Некорректный месяц' }, { status: 400 })
  }
  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: 'Нет данных для сохранения' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Подтягиваем существующие записи разом, чтобы корректно вести paidAt.
  const existingRows = await query<Record<string, unknown>>(
    'SELECT * FROM salary_records WHERE month = $1',
    [month],
  )
  const existing = new Map(existingRows.map((r) => [r.id as string, r]))

  const saved: SalaryRecord[] = []

  for (const row of rows) {
    const employeeId = String(row.employeeId)
    if (!employeeId) continue

    const hours = Number(row.hours) || 0
    const hourlyRate = Number(row.hourlyRate) || 0
    const bonuses = Number(row.bonuses) || 0
    const deductions = Number(row.deductions) || 0
    const paid = Boolean(row.paid)

    const id = salaryRecordId(month, employeeId)
    const prev = existing.get(id)
    const wasPaid = Boolean(prev?.paid)
    const paidAt = paid ? (wasPaid ? ((prev?.paid_at as string) ?? now) : now) : null

    const total = computeTotal(hours, hourlyRate, bonuses, deductions)

    const result = await query<Record<string, unknown>>(
      `INSERT INTO salary_records (id, employee_id, month, hours, hourly_rate, bonuses, deductions, total, paid, paid_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         hours = $4,
         hourly_rate = $5,
         bonuses = $6,
         deductions = $7,
         total = $8,
         paid = $9,
         paid_at = $10,
         updated_at = $11
       RETURNING *`,
      [id, employeeId, month, hours, hourlyRate, bonuses, deductions, total, paid, paidAt, now],
    )
    saved.push(rowToSalaryRecord(result[0]))
  }

  return NextResponse.json({ records: saved })
}

// DELETE /api/salaries?month=YYYY-MM — удалить всю ведомость за месяц
// (на случай загрузки отчёта не в тот месяц).
export async function DELETE(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const month = new URL(req.url).searchParams.get('month')
  if (!isValidMonth(month)) {
    return NextResponse.json({ error: 'Некорректный месяц' }, { status: 400 })
  }

  const result = await query<Record<string, unknown>>(
    'DELETE FROM salary_records WHERE month = $1 RETURNING id',
    [month],
  )
  return NextResponse.json({ deleted: result.length })
}
