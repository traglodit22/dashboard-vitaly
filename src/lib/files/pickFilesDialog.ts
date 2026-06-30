/** Safari: системный диалог Finder — файлы читаются, в отличие от «Фото» в input. */
export async function pickFilesViaSystemDialog(acceptImages = false): Promise<File[]> {
  const picker = (
    window as Window & {
      showOpenFilePicker?: (opts: {
        multiple?: boolean
        types?: { accept: Record<string, string[]> }[]
      }) => Promise<FileSystemFileHandle[]>
    }
  ).showOpenFilePicker

  if (!picker) {
    throw new Error('showOpenFilePicker недоступен')
  }

  const imageTypes = {
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'] },
  }
  const types = acceptImages ?
      [imageTypes]
    : [
        imageTypes,
        { accept: { 'application/pdf': ['.pdf'] } },
      ]

  const handles = await picker({ multiple: true, types })
  const files: File[] = []
  for (const handle of handles) {
    files.push(await handle.getFile())
  }
  return files
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

export function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg/i.test(ua)
}
