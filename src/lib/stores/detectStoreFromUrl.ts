import type { StoreType } from '@/types'

/** Определяет магазин по URL товара (как в отправках). */
export function detectStoreFromUrl(url: string): StoreType | null {
  const lower = url.trim().toLowerCase()
  if (!lower) return null

  if (
    lower.includes('yangkeduo.com') ||
    lower.includes('pinduoduo.com') ||
    lower.includes('pdd.com')
  ) {
    return 'PinDuoDuo'
  }
  if (lower.includes('1688.com')) return '1688'
  if (lower.includes('taobao.com') || lower.includes('tmall.com')) return 'TaoBao'
  if (
    lower.includes('goofish.com') ||
    lower.includes('idlefish') ||
    lower.includes('xianyu')
  ) {
    return 'GooFish'
  }

  return 'Другое'
}
