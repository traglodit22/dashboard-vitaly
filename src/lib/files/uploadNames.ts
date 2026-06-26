/** Safari/WebKit сбрасывает File после input.value = "" — для нескольких файлов читаем blob заранее. */
export async function snapshotFilesForUpload(fileList: FileList | File[]): Promise<File[]> {
  const list = Array.from(fileList)
  if (list.length <= 1) return list

  return Promise.all(
    list.map(async (file) => {
      try {
        const buffer = await file.arrayBuffer()
        return new File([buffer], file.name, {
          type: file.type || 'application/octet-stream',
          lastModified: file.lastModified,
        })
      } catch {
        return file
      }
    }),
  )
}

/** Сообщение WebKit «The string did not match the expected pattern» при битом File в FormData. */
export function formatUploadClientError(err: unknown): string {
  if (!(err instanceof Error)) return 'Ошибка загрузки'
  if (/did not match the expected pattern/i.test(err.message)) {
    return 'Браузер не смог прочитать файл. Повторите загрузку или выберите файлы по одному.'
  }
  return err.message || 'Ошибка загрузки'
}

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
