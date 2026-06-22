import { LIMITS } from './constants'
import { STORES, type StoreType, type Recipient } from '@/types'

function isValidUrl(s: string): boolean {
  try {
    new URL(s)
    return true
  } catch {
    return false
  }
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

// Черновик заказа (то, что вводит оператор). Трек-код — НЕ обязателен.
export interface OrderDraft {
  itemDescription: string
  numberOfItemPieces: number
  itemPrice: number
  itemStoreLink: string
  store: StoreType
  incomingDeclaration?: string
}

export function validateOrderDraft(o: OrderDraft): string[] {
  const errors: string[] = []
  if (!o.itemDescription?.trim() || o.itemDescription.length >= LIMITS.itemDescriptionMax)
    errors.push(`Описание товара обязательно и должно быть короче ${LIMITS.itemDescriptionMax} символов`)
  if (!(o.numberOfItemPieces > 0)) errors.push('Количество должно быть больше 0')
  if (!(o.itemPrice > 0)) errors.push('Цена за штуку должна быть больше 0')
  if (!isValidUrl(o.itemStoreLink)) errors.push('Ссылка на товар должна быть корректным URL')
  if (!STORES.includes(o.store)) errors.push('Выберите магазин')
  // Трек необязателен; если указан — проверяем длину.
  const track = o.incomingDeclaration?.trim()
  if (track && track.length >= LIMITS.incomingDeclarationMax)
    errors.push(`Трек по Китаю должен быть короче ${LIMITS.incomingDeclarationMax} символов`)
  return errors
}

// Приводит сырое тело запроса к полям получателя (общее для создания и редактирования).
// Необязательные пустые поля → undefined; серия/ИНН у белорусов остаются пустой строкой.
export function parseRecipientBody(
  body: Record<string, unknown>,
): Omit<Recipient, 'id' | 'createdAt'> {
  const s = (v: unknown) => String(v ?? '').trim()
  return {
    familyName: s(body.familyName),
    name: s(body.name),
    middleName: s(body.middleName) || undefined,
    passportSerial: s(body.passportSerial),
    passportNumber: s(body.passportNumber),
    passportIssueDate: s(body.passportIssueDate),
    birthDate: s(body.birthDate) || undefined,
    inn: s(body.inn),
    fullAddress: s(body.fullAddress),
    city: s(body.city),
    state: s(body.state),
    zipCode: s(body.zipCode),
    phoneNumber: s(body.phoneNumber),
    email: s(body.email),
  }
}

export function validateRecipient(r: Recipient): string[] {
  const errors: string[] = []
  const who = `${r.familyName ?? ''} ${r.name ?? ''}`.trim() || 'получатель'
  if (!r.familyName?.trim()) errors.push(`[${who}] Фамилия обязательна`)
  if (!r.name?.trim()) errors.push(`[${who}] Имя обязательно`)
  // Серия необязательна (у белорусов её нет). Если указана — ровно 4 символа.
  if (r.passportSerial && r.passportSerial.length !== LIMITS.passportSerialLen)
    errors.push(`[${who}] Серия паспорта — ровно ${LIMITS.passportSerialLen} символа или пусто (для РБ)`)
  // Номер: 6 (РФ, цифры) или 9 (РБ, буквы+цифры).
  if (!r.passportNumber || !LIMITS.passportNumberLens.includes(r.passportNumber.length))
    errors.push(`[${who}] Номер паспорта — 6 цифр (РФ) или 9 символов (РБ)`)
  if (!r.passportIssueDate) errors.push(`[${who}] Дата выдачи паспорта обязательна`)
  // ИНН необязателен (у белорусов нет); если указан — ровно 12 символов.
  if (r.inn && r.inn.length !== LIMITS.innLen)
    errors.push(`[${who}] ИНН — ровно ${LIMITS.innLen} символов или пусто (для РБ)`)
  if (!r.fullAddress?.trim()) errors.push(`[${who}] Полный адрес обязателен`)
  if (!r.city?.trim()) errors.push(`[${who}] Город обязателен`)
  if (!r.state?.trim()) errors.push(`[${who}] Область обязательна`)
  if (!r.zipCode?.trim()) errors.push(`[${who}] Индекс обязателен`)
  if (!r.phoneNumber?.trim()) errors.push(`[${who}] Телефон обязателен`)
  if (!isValidEmail(r.email ?? '')) errors.push(`[${who}] Некорректный email`)
  return errors
}
