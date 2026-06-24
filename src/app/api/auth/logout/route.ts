import { clearSession } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  await clearSession(req)
  return Response.json({ ok: true })
}
