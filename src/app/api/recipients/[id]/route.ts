import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { requireAuth } from '@/lib/auth/requireAuth'
import { validateRecipient, parseRecipientBody } from '@/lib/delivery/validation'
import type { Recipient } from '@/types'

export const runtime = 'nodejs'

function rowToRecipient(row: Record<string, unknown>): Recipient {
  return {
    id: row.id as string,
    familyName: row.family_name as string,
    name: row.name as string,
    middleName: (row.middle_name as string) ?? undefined,
    passportSerial: row.passport_serial as string,
    passportNumber: row.passport_number as string,
    passportIssueDate: row.passport_issue_date as string,
    birthDate: (row.birth_date as string) ?? undefined,
    inn: row.inn as string,
    fullAddress: row.full_address as string,
    city: row.city as string,
    state: row.state as string,
    zipCode: row.zip_code as string,
    phoneNumber: row.phone_number as string,
    email: row.email as string,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

// Редактирование получателя. createdAt не трогаем (порядок round-robin сохраняется).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const { id } = await params

  const existing = await query<Record<string, unknown>>(
    'SELECT * FROM recipients WHERE id = $1',
    [id],
  )
  if (existing.length === 0) return NextResponse.json({ error: 'Получатель не найден' }, { status: 404 })

  const body = await req.json()
  const fields = parseRecipientBody(body)

  const errors = validateRecipient({ id, createdAt: '', ...fields })
  if (errors.length) return NextResponse.json({ errors }, { status: 400 })

  const rows = await query<Record<string, unknown>>(
    `UPDATE recipients SET
      family_name = $1,
      name = $2,
      middle_name = $3,
      passport_serial = $4,
      passport_number = $5,
      passport_issue_date = $6,
      birth_date = $7,
      inn = $8,
      full_address = $9,
      city = $10,
      state = $11,
      zip_code = $12,
      phone_number = $13,
      email = $14
    WHERE id = $15 RETURNING *`,
    [
      fields.familyName,
      fields.name,
      fields.middleName ?? null,
      fields.passportSerial,
      fields.passportNumber,
      fields.passportIssueDate,
      fields.birthDate ?? null,
      fields.inn,
      fields.fullAddress,
      fields.city,
      fields.state,
      fields.zipCode,
      fields.phoneNumber,
      fields.email,
      id,
    ],
  )

  return NextResponse.json({ recipient: rowToRecipient(rows[0]) })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const { id } = await params
  await query('DELETE FROM recipients WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
