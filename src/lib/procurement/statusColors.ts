export const STATUS_COLOR_KEYS = ['red', 'orange', 'green', 'white', 'gray', 'purple'] as const
export type StatusColorKey = (typeof STATUS_COLOR_KEYS)[number]

export const STATUS_ROW_CLASS: Record<StatusColorKey, string> = {
  red: '!bg-red-500/30 border-l-4 border-l-red-600 hover:!bg-red-500/35',
  orange: '!bg-orange-400/35 border-l-4 border-l-orange-500 hover:!bg-orange-400/40',
  green: '!bg-emerald-500/30 border-l-4 border-l-emerald-600 hover:!bg-emerald-500/35',
  white:
    '!bg-white border-l-4 border-l-neutral-300 hover:!bg-white dark:!bg-white/20 dark:border-l-neutral-400 dark:hover:!bg-white/25',
  gray: '!bg-neutral-400/35 border-l-4 border-l-neutral-600 hover:!bg-neutral-400/40',
  purple: '!bg-violet-500/35 border-l-4 border-l-violet-600 hover:!bg-violet-500/40',
}

export const STATUS_SWATCH_CLASS: Record<StatusColorKey, string> = {
  red: 'bg-red-500 border-red-700',
  orange: 'bg-orange-400 border-orange-600',
  green: 'bg-emerald-500 border-emerald-700',
  white: 'bg-white border-neutral-400 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]',
  gray: 'bg-neutral-500 border-neutral-700',
  purple: 'bg-violet-500 border-violet-700',
}

export const STATUS_COLOR_LABEL: Record<StatusColorKey, string> = {
  red: 'Красный',
  orange: 'Оранжевый',
  green: 'Зелёный',
  white: 'Белый',
  gray: 'Серый',
  purple: 'Фиолетовый',
}

export function parseStatusColorKey(value: unknown): StatusColorKey {
  if (typeof value === 'string' && value in STATUS_ROW_CLASS) {
    return value as StatusColorKey
  }
  return 'gray'
}
