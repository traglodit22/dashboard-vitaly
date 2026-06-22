// Магазин-источник товара — только для внутреннего учёта, в ДоброПост НЕ отправляется.
export const STORES = ['1688', 'TaoBao', 'PinDuoDuo', 'GooFish', 'Другое'] as const
export type StoreType = (typeof STORES)[number]

// Локальный жизненный цикл заказа (не путать со статусами ДоброПост).
export type OrderStatus = 'awaiting_track' | 'ready' | 'sent'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_track: 'Ожидает трек-код',
  ready: 'Готов к отправке',
  sent: 'Отправлено в ДоброПост',
}

// Получатель (consignee) — отдельный справочник. Подставляется по кругу (round-robin).
export interface Recipient {
  id: string
  familyName: string // consigneeFamilyName
  name: string // consigneeName
  middleName?: string // consigneeMiddleName (необязательно)
  passportSerial: string // ровно 4 символа
  passportNumber: string // ровно 6 символов
  passportIssueDate: string // ISO date (YYYY-MM-DD)
  birthDate?: string // обязателен только для тарифа DP Ultra
  inn: string // vatIdentificationNumber — ровно 12 символов
  fullAddress: string
  city: string
  state: string
  zipCode: string
  phoneNumber: string
  email: string
  createdAt: string
}

// Товар/отправка.
export interface ProductOrder {
  id: string
  // вводится оператором:
  itemDescription: string // < 60 символов
  numberOfItemPieces: number // количество
  itemPrice: number // цена за штуку, юани
  itemStoreLink: string // URL товара
  store: StoreType // магазин-источник (только для нас)
  incomingDeclaration?: string | null // трек по Китаю, < 16 символов — НЕ обязателен при создании
  // вычисляется:
  totalAmount: number // numberOfItemPieces * itemPrice
  status: OrderStatus
  // заполняется после отправки в ДоброПост:
  recipientId?: string | null
  dpShipmentId?: number | null
  dpTrackNumber?: string | null
  dpStatusId?: number | null
  dpStatusName?: string | null
  dpWeightKg?: number | null // вес посылки, кг — приходит от ДоброПост после получения на складе
  lastError?: string | null
  createdAt: string
  updatedAt: string
}

// Сотрудник SmmLaba. Зарплата почасовая: часы из тайм-трекера × ставка.
export interface Employee {
  id: string
  name: string
  role: string // должность (необязательна по смыслу, но храним строкой)
  hourlyRate: number // ставка ₽/час
  trackerEmail: string // email из тайм-трекера — ключ сопоставления отчёта с сотрудником
  active: boolean // false = в архиве (история начислений сохраняется)
  telegramId?: string // на будущее — уведомления о выплате
  createdAt: string
}

// Начисление за месяц (одна запись = сотрудник × месяц). id = `${month}_${employeeId}`.
export interface SalaryRecord {
  id: string
  employeeId: string
  month: string // "2026-06"
  hours: number // импортировано из отчёта тайм-трекера
  hourlyRate: number // зафиксирована на момент расчёта
  bonuses: number // премии ₽
  deductions: number // удержания ₽
  total: number // hours*hourlyRate + bonuses - deductions
  paid: boolean
  paidAt?: string | null
  updatedAt: string
}
