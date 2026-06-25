export interface SettingsData {
  dobropostEmail: string
  dobropostConfigured: boolean
  autoCheckEnabled: boolean
  autoCheckIntervalHours: number
  autoCheckLastRunAt: string | null
  telegramNotifyEnabled: boolean
  telegramNotifyChatIds: string[]
  telegramBotConfigured: boolean
  deepseekConfigured: boolean
  siteTitle: string
  hasFavicon: boolean
}

export const EMPTY_SETTINGS: SettingsData = {
  dobropostEmail: '',
  dobropostConfigured: false,
  autoCheckEnabled: false,
  autoCheckIntervalHours: 12,
  autoCheckLastRunAt: null,
  telegramNotifyEnabled: false,
  telegramNotifyChatIds: [],
  telegramBotConfigured: false,
  deepseekConfigured: false,
  siteTitle: '',
  hasFavicon: false,
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '—'
  const units = ['Б', 'КБ', 'МБ', 'ГБ']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatMsk(iso: string | null): string {
  if (!iso) return '—'
  return (
    new Date(iso).toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' МСК'
  )
}
