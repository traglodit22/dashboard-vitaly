/** Имя файла без пути (Finder иногда кладёт полный путь в name). */
export function uploadBaseName(fileName: string): string {
  const normalized = fileName.replace(/\\/g, '/').trim()
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? normalized
}

/** Убирает /Volumes/… и /Users/… из путей drag-and-drop с Mac. */
export function normalizeDroppedRelativePath(path: string): string {
  const trimmed = path.replace(/\\/g, '/').trim()
  if (!trimmed || !trimmed.startsWith('/')) return trimmed

  const parts = trimmed.split('/').filter(Boolean)
  if (parts[0] === 'Volumes' && parts.length >= 3) {
    return parts.slice(2).join('/')
  }
  if (parts[0] === 'Users' && parts.length >= 3) {
    return parts.slice(2).join('/')
  }
  return parts[parts.length - 1] ?? trimmed
}
