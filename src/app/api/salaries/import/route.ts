import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { parseTimeReport } from '@/lib/salaries/parseReport'

export const runtime = 'nodejs'

interface MatchedRow {
  employeeId: string
  name: string
  trackerEmail: string
  hours: number
}

interface UnmatchedRow {
  name: string
  email: string
  hours: number
}

// POST /api/salaries/import — приём xlsx-отчёта тайм-трекера (multipart).
// Парсит файл и сопоставляет строки с сотрудниками по trackerEmail.
// Ничего не сохраняет — возвращает превью для подстановки в ведомость на клиенте.
export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
  }

  let rows
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    rows = parseTimeReport(buffer)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Не удалось прочитать файл'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Карта email → сотрудник (только активные участвуют в сопоставлении).
  const empRows = await query<Record<string, unknown>>(
    'SELECT id, name, tracker_email FROM employees WHERE active = true',
  )
  const byEmail = new Map<string, { id: string; name: string }>()
  for (const emp of empRows) {
    const email = String(emp.tracker_email ?? '').trim().toLowerCase()
    if (email) byEmail.set(email, { id: emp.id as string, name: String(emp.name ?? '') })
  }

  const matched: MatchedRow[] = []
  const unmatched: UnmatchedRow[] = []
  for (const row of rows) {
    const emp = row.email ? byEmail.get(row.email) : undefined
    if (emp) {
      matched.push({ employeeId: emp.id, name: emp.name, trackerEmail: row.email, hours: row.hours })
    } else {
      unmatched.push({ name: row.name, email: row.email, hours: row.hours })
    }
  }

  return NextResponse.json({ matched, unmatched })
}
