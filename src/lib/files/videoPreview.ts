import { spawn } from 'child_process'
import { PREVIEW_MAX_PX } from '@/lib/files/previewConstants'

const FFMPEG_TIMEOUT_MS = 45_000

function runFfmpegFrame(input: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      '1',
      '-i',
      input,
      '-frames:v',
      '1',
      '-vf',
      `scale=${PREVIEW_MAX_PX}:${PREVIEW_MAX_PX}:force_original_aspect_ratio=decrease`,
      '-f',
      'webp',
      '-quality',
      '80',
      'pipe:1',
    ]
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error('ffmpeg timeout'))
    }, FFMPEG_TIMEOUT_MS)

    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    proc.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk))
    proc.on('error', (err) => {
      clearTimeout(timer)
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') reject(new Error('ffmpeg not installed'))
      else reject(err)
    })
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks))
        return
      }
      const detail = Buffer.concat(errChunks).toString('utf8').slice(0, 240)
      reject(new Error(`ffmpeg exit ${code ?? '?'}${detail ? `: ${detail}` : ''}`))
    })
  })
}

/** Кадр из видео (локальный путь или HTTP URL). */
export async function renderVideoPreview(inputPathOrUrl: string): Promise<Buffer | null> {
  try {
    return await runFfmpegFrame(inputPathOrUrl)
  } catch (err) {
    console.error('[files] video preview failed:', err)
    return null
  }
}
