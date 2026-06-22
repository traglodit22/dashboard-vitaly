import { query } from '@/lib/db/index'
import type { Recipient } from '@/types'

function rowToRecipient(row: Record<string, unknown>): Recipient {
  return {
    id: row.id as string,
    familyName: row.family_name as string,
    name: row.name as string,
    middleName: (row.middle_name as string | null) ?? undefined,
    passportSerial: row.passport_serial as string,
    passportNumber: row.passport_number as string,
    passportIssueDate: row.passport_issue_date as string,
    birthDate: (row.birth_date as string | null) ?? undefined,
    inn: row.inn as string,
    fullAddress: row.full_address as string,
    city: row.city as string,
    state: row.state as string,
    zipCode: row.zip_code as string,
    phoneNumber: row.phone_number as string,
    email: row.email as string,
    createdAt: row.created_at instanceof Date
      ? (row.created_at as Date).toISOString()
      : (row.created_at as string),
  }
}

/**
 * Round-robin выбор получателя «по очереди».
 * Атомарно инкрементирует recipient_rotation_index в system_settings и
 * возвращает следующего получателя (упорядоченных по created_at).
 */
export async function getNextRecipient(): Promise<Recipient> {
  const recipients = await query<Record<string, unknown>>(
    'SELECT * FROM recipients ORDER BY created_at ASC',
  )
  if (recipients.length === 0) {
    throw new Error('Нет ни одного получателя — добавьте получателей в дашборде')
  }

  // Атомарно вычисляем следующий индекс через UPDATE ... RETURNING.
  // (recipient_rotation_index + 1) % $1 гарантирует корректный round-robin.
  const result = await query<{ recipient_rotation_index: number }>(
    `UPDATE system_settings
     SET recipient_rotation_index = (recipient_rotation_index + 1) % $1
     WHERE id = 1
     RETURNING recipient_rotation_index`,
    [recipients.length],
  )

  const index = result[0].recipient_rotation_index
  return rowToRecipient(recipients[index])
}
