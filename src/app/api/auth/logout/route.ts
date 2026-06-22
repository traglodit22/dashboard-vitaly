import { clearSession } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST(): Promise<Response> {
  await clearSession()
  return Response.json({ ok: true })
}
