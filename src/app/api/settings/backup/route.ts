import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { listVpsBackupRuns, runVpsBackup } from '@/lib/backup/vpsBackup'
import { isGcsConfigured } from '@/lib/files/gcsStorage'

export const runtime = 'nodejs'
export const maxDuration = 600

export async function GET(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  try {
    const runs = await listVpsBackupRuns()
    return NextResponse.json({
      gcsConfigured: isGcsConfigured(),
      runs,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const body = await req.json().catch(() => ({}))
  const database = Boolean(body.database ?? body.includeDatabase)
  const files = Boolean(body.files ?? body.includeFiles)

  try {
    const run = await runVpsBackup({ database, files })
    return NextResponse.json({ run })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[settings/backup]:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
