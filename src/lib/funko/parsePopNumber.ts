/** Номер Pop из названия, например «Naruto #123» → 123. */
export function parsePopNumber(title: string): number | null {
  const match = title.match(/#(\d+)/)
  if (!match) return null
  const n = Number.parseInt(match[1], 10)
  return Number.isFinite(n) ? n : null
}
