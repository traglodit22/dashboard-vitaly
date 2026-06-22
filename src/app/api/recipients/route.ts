import { NextResponse } from 'next/server'
import { query } from '@/lib/db/index'
import { validateRecipient, parseRecipientBody } from '@/lib/delivery/validation'
import { requireAuth } from '@/lib/auth/requireAuth'
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

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM recipients ORDER BY created_at ASC',
  )
  const recipients = rows.map(rowToRecipient)
  return NextResponse.json({ recipients })
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth
  const body = await req.json()
  const now = new Date().toISOString()
  const fields = parseRecipientBody(body)

  const errors = validateRecipient({ id: 'new', createdAt: now, ...fields })
  if (errors.length) return NextResponse.json({ errors }, { status: 400 })

  const rows = await query<Record<string, unknown>>(
    `INSERT INTO recipients (
      family_name, name, middle_name,
      passport_serial, passport_number, passport_issue_date,
      birth_date, inn, full_address,
      city, state, zip_code,
      phone_number, email, created_at
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6,
      $7, $8, $9,
      $10, $11, $12,
      $13, $14, $15
    ) RETURNING *`,
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
      now,
    ],
  )

  return NextResponse.json({ recipient: rowToRecipient(rows[0]) })
}
