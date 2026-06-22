import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'

// Возвращает 401, если сессионная cookie отсутствует или невалидна.
// Использовать в начале каждого защищённого роута.
export async function requireAuth(req: Request): Promise<NextResponse | null> {
  const ok = await getSession(req)
  if (!ok) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  return null
}
