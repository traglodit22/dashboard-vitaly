export const STATUS_COLOR_KEYS = ['red', 'orange', 'green', 'white', 'gray', 'purple', 'blue'] as const
export type StatusColorKey = (typeof STATUS_COLOR_KEYS)[number]

export const STATUS_ROW_CLASS: Record<StatusColorKey, string> = {
  red: '!bg-red-500/[0.06] border-l-2 border-l-red-400/30 hover:!bg-red-500/10',
  orange: '!bg-orange-400/[0.07] border-l-2 border-l-orange-400/30 hover:!bg-orange-400/10',
  green: '!bg-emerald-500/[0.06] border-l-2 border-l-emerald-400/30 hover:!bg-emerald-500/10',
  white:
    '!bg-neutral-50/80 border-l-2 border-l-neutral-300/50 hover:!bg-neutral-50 dark:!bg-white/[0.04] dark:border-l-neutral-500/30 dark:hover:!bg-white/[0.06]',
  gray: '!bg-neutral-400/[0.08] border-l-2 border-l-neutral-400/35 hover:!bg-neutral-400/12',
  purple: '!bg-violet-500/[0.06] border-l-2 border-l-violet-400/30 hover:!bg-violet-500/10',
  blue: '!bg-sky-500/[0.06] border-l-2 border-l-sky-400/30 hover:!bg-sky-500/10',
}

export const STATUS_SWATCH_CLASS: Record<StatusColorKey, string> = {
  red: 'bg-red-400/70 border-red-400/50',
  orange: 'bg-orange-400/70 border-orange-400/50',
  green: 'bg-emerald-400/70 border-emerald-400/50',
  white: 'bg-neutral-100 border-neutral-300/80 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]',
  gray: 'bg-neutral-400/70 border-neutral-400/50',
  purple: 'bg-violet-400/70 border-violet-400/50',
  blue: 'bg-sky-400/70 border-sky-400/50',
}

export const STATUS_COLOR_LABEL: Record<StatusColorKey, string> = {
  red: 'Красный',
  orange: 'Оранжевый',
  green: 'Зелёный',
  white: 'Белый',
  gray: 'Серый',
  purple: 'Фиолетовый',
  blue: 'Голубой',
}

export function parseStatusColorKey(value: unknown): StatusColorKey {
  if (typeof value === 'string' && value in STATUS_ROW_CLASS) {
    return value as StatusColorKey
  }
  return 'gray'
}
