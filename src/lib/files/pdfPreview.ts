import path from 'path'
import { pathToFileURL } from 'url'
import { createRequire } from 'module'
import { createCanvas } from '@napi-rs/canvas'

const require = createRequire(import.meta.url)

function pdfjsAssetUrl(subdir: string): string {
  const pkgDir = path.dirname(require.resolve('pdfjs-dist/package.json'))
  return `${pathToFileURL(path.join(pkgDir, subdir)).href}/`
}

/** Рендер первой страницы PDF в WebP-превью. */
export async function renderPdfPreview(pdfBuffer: Buffer): Promise<Buffer | null> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: true,
      standardFontDataUrl: pdfjsAssetUrl('standard_fonts'),
      cMapUrl: pdfjsAssetUrl('cmaps'),
      cMapPacked: true,
    })
    const pdf = await loadingTask.promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const maxW = 480
    const scale = Math.min(maxW / viewport.width, maxW / viewport.height, 2)
    const scaled = page.getViewport({ scale })
    const canvas = createCanvas(Math.ceil(scaled.width), Math.ceil(scaled.height))
    const ctx = canvas.getContext('2d')
    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport: scaled,
      canvas: canvas as unknown as HTMLCanvasElement,
    }).promise
    return canvas.toBuffer('image/webp')
  } catch (err) {
    console.error('[files] PDF preview failed:', err)
    return null
  }
}

/** Превью для изображения — уменьшенная копия в WebP. */
export async function renderImagePreview(imageBuffer: Buffer): Promise<Buffer | null> {
  try {
    const { loadImage } = await import('@napi-rs/canvas')
    const img = await loadImage(imageBuffer)
    const maxW = 480
    const scale = Math.min(maxW / img.width, maxW / img.height, 1)
    const w = Math.ceil(img.width * scale)
    const h = Math.ceil(img.height * scale)
    const canvas = createCanvas(w, h)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toBuffer('image/webp')
  } catch (err) {
    console.error('[files] image preview failed:', err)
    return null
  }
}

export async function buildFilePreview(
  mime: string,
  buffer: Buffer,
): Promise<Buffer | null> {
  if (mime === 'application/pdf') return renderPdfPreview(buffer)
  if (mime.startsWith('image/')) return renderImagePreview(buffer)
  return null
}
