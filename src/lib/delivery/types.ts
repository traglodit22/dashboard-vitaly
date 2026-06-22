// Типы запросов/ответов ДоброПост Shipment API.

export interface ShipmentCreatePayload {
  totalAmount: number
  consigneeFamilyName: string
  consigneeName: string
  consigneeMiddleName?: string
  consigneePassportSerial: string
  consigneePassportNumber: string
  passportIssueDate: string
  consigneeBirthDate?: string
  vatIdentificationNumber: string
  consigneeFullAddress: string
  consigneeCity: string
  consigneeState: string
  consigneeZipCode: string
  consigneePhoneNumber: string
  consigneeEmail: string
  itemDescription: string
  numberOfItemPieces: number
  itemPrice: number
  itemStoreLink: string
  dpTariffId: number
  incomingDeclaration: string
  comment: string
  withChecking: boolean
  withPhotoReport: boolean
  removePostalPackaging: boolean
}

export interface ShipmentResponse {
  id: number
  DPTrackNumber: string
  totalAmount: number
  currency: string
  totalWeightKG: number
  itemWeight: number
  status: { id: number; name: string }
  deliveryCost: number
  incomingDeclaration: string
  comment: string
  created: string
  [key: string]: unknown
}

export interface ShipmentListResponse {
  content: ShipmentResponse[]
  [key: string]: unknown
}

// Входящий webhook от ДоброПост (обновление статуса отправки).
export interface ShipmentStatusWebhook {
  shipmentId: number
  DPTrackNumber: string
  statusDate: string // ISO 8601
  status: string
}
