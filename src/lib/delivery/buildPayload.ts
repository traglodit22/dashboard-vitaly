import { DOBROPOST } from './constants'
import type { ShipmentCreatePayload } from './types'
import type { Recipient } from '@/types'

// Ценность = количество × цена за штуку (юани). Округляем до копеек.
export function computeTotalAmount(pieces: number, pricePerUnit: number): number {
  return Math.round(pieces * pricePerUnit * 100) / 100
}

// Поля товара, нужные для отправки в ДоброПост (трек обязателен на этом этапе).
export interface ShipmentItemInput {
  itemDescription: string
  numberOfItemPieces: number
  itemPrice: number
  itemStoreLink: string
  incomingDeclaration: string
}

// Мобильные share-ссылки маркетплейсов (Taobao/1688/PinDuoDuo) тащат килобайты
// трекинг-параметров в query (utparam, ab_info, tpp_buckets...). У ДоброПост в БД
// колонка под ссылку не резиновая — на таких ссылках insert падает 500-кой
// (Hibernate DataException) без внятного текста. Обрезаем до домена+пути+первого
// параметра (как правило это и есть id товара) — ссылка остаётся рабочей и короткой.
function shortenStoreLink(raw: string): string {
  try {
    const u = new URL(raw)
    const firstParam = u.search.slice(1).split('&')[0]
    return `${u.origin}${u.pathname}${firstParam ? '?' + firstParam : ''}`
  } catch {
    return raw
  }
}

// Собирает полный payload для ДоброПост: товар + подставленный получатель + константы.
// Поле `store` (магазин) в payload НЕ попадает — оно только для внутреннего учёта.
export function buildShipmentPayload(
  order: ShipmentItemInput,
  recipient: Recipient,
): ShipmentCreatePayload {
  return {
    totalAmount: computeTotalAmount(order.numberOfItemPieces, order.itemPrice),
    consigneeFamilyName: recipient.familyName,
    consigneeName: recipient.name,
    consigneeMiddleName: recipient.middleName ?? '',
    // Серия паспорта и ИНН: у белорусов их нет — отправляем пустой строкой,
    // а не пропускаем поле (?? '' страхует от null/undefined в старых записях).
    consigneePassportSerial: recipient.passportSerial ?? '',
    consigneePassportNumber: recipient.passportNumber,
    passportIssueDate: recipient.passportIssueDate,
    consigneeBirthDate: recipient.birthDate ?? '',
    vatIdentificationNumber: recipient.inn ?? '',
    consigneeFullAddress: recipient.fullAddress,
    consigneeCity: recipient.city,
    consigneeState: recipient.state,
    consigneeZipCode: recipient.zipCode,
    consigneePhoneNumber: recipient.phoneNumber,
    consigneeEmail: recipient.email,
    itemDescription: order.itemDescription,
    numberOfItemPieces: order.numberOfItemPieces,
    itemPrice: order.itemPrice,
    itemStoreLink: shortenStoreLink(order.itemStoreLink),
    dpTariffId: DOBROPOST.tariffId,
    incomingDeclaration: order.incomingDeclaration,
    comment: DOBROPOST.comment,
    withChecking: DOBROPOST.withChecking,
    withPhotoReport: DOBROPOST.withPhotoReport,
    removePostalPackaging: DOBROPOST.removePostalPackaging,
  }
}
