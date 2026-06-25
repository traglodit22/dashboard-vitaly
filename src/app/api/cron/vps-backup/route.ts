import { NextResponse } from 'next/server'
import { runScheduledVpsBackup } from '@/lib/backup/vpsBackup'

export const runtime = 'nodejs'
export const maxDuration = 600

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse(null, { status: 401 })
  }

  try {
    const result = await runScheduledVpsBackup()
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron/vps-backup]:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
