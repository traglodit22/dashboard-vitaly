import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { listFavoriteFolders } from '@/lib/files/folderService'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const folders = await listFavoriteFolders()
  return NextResponse.json({ folders })
}
