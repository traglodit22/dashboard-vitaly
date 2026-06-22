import { query } from '@/lib/db/index'

export const runtime = 'nodejs'

export async function GET() {
  const rows = await query<Record<string, unknown>>('SELECT favicon_base64 FROM system_settings WHERE id=1')
  const b64 = rows[0]?.favicon_base64 as string | null
  if (!b64) return new Response(null, { status: 404 })

  // Detect mime type from base64 data URL prefix or raw base64
  let mimeType = 'image/png'
  let data = b64
  if (b64.startsWith('data:')) {
    const match = b64.match(/^data:([^;]+);base64,(.+)$/)
    if (match) { mimeType = match[1]; data = match[2] }
  }

  const buffer = Buffer.from(data, 'base64')
  return new Response(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
