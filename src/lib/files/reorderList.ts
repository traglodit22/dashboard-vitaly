export function reorderById<T extends { id: string }>(
  list: T[],
  fromId: string,
  toId: string,
): T[] {
  const from = list.findIndex((x) => x.id === fromId)
  const to = list.findIndex((x) => x.id === toId)
  if (from < 0 || to < 0 || from === to) return list
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function sortOrderValues(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * 10)
}
