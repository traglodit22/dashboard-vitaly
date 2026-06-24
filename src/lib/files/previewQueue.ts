import { ensureFilePreview, fetchFileRow } from '@/lib/files/fileService'

const MAX_CONCURRENT = 5
const queued = new Set<string>()
const inFlight = new Set<string>()
let active = 0

function pump(): void {
  if (active >= MAX_CONCURRENT) return
  const next = [...queued].find((id) => !inFlight.has(id))
  if (!next) return

  queued.delete(next)
  inFlight.add(next)
  active += 1

  void (async () => {
    try {
      const row = await fetchFileRow(next)
      if (row) await ensureFilePreview(row)
    } catch (err) {
      console.error('[files] background preview failed', next, err)
    } finally {
      inFlight.delete(next)
      active -= 1
      pump()
    }
  })()
}

/** Поставить генерацию превью в очередь (не блокирует HTTP-запрос). */
export function schedulePreviewGeneration(fileId: string): void {
  if (inFlight.has(fileId) || queued.has(fileId)) return
  queued.add(fileId)
  pump()
}

export function schedulePreviewGenerationBatch(fileIds: string[]): void {
  for (const id of fileIds) schedulePreviewGeneration(id)
}
