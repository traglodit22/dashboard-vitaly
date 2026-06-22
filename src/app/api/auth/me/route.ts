import { getSession } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function GET(req: Request): Promise<Response> {
  const ok = await getSession(req)
  if (!ok) {
    return Response.json({ error: 'Не авторизован' }, { status: 401 })
  }
  return Response.json({ ok: true })
}
