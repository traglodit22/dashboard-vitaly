// Константы интеграции с ДоброПост (заданы клиентом).
export const DOBROPOST = {
  apiUrl: process.env.DOBROPOST_API_URL ?? 'https://api.dobropost.com',
  tariffId: 31, // dpTariffId — всегда 31
  comment: 'доставка курьером', // comment — всегда этот текст
  withChecking: false, // проверка содержимого — всегда нет
  withPhotoReport: false, // фотоотчёт — всегда нет
  removePostalPackaging: false, // снять упаковку — всегда нет
} as const

// Ограничения полей из документации API (для валидации).
export const LIMITS = {
  itemDescriptionMax: 60, // itemDescription < 60
  commentMax: 60, // comment < 60
  incomingDeclarationMax: 16, // incomingDeclaration < 16
  passportSerialLen: 4, // РФ — ровно 4; РБ — серии нет (пусто)
  passportNumberLens: [6, 9] as readonly number[], // РФ — 6 цифр; РБ — 9 (буквы+цифры)
  innLen: 12, // ровно 12
  recommendedMaxPieces: 4, // рекомендация API: не более 4 шт
} as const
