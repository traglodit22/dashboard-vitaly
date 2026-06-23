import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { deleteFolder, fetchFolder, updateFolderSettings } from '@/lib/files/folderService'
import { rowToFileFolder } from '@/lib/files/mapRow'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(_req)
  if (unauth) return unauth

  const { id } = await params
  const row = await fetchFolder(id)
  if (!row) {
    return NextResponse.json({ error: 'Папка не найдена' }, { status: 404 })
  }

  return NextResponse.json({ folder: rowToFileFolder(row) })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params
  const body = await req.json()

  try {
    const folder = await updateFolderSettings(id, {
      name: body.name !== undefined ? String(body.name) : undefined,
      moduleTextEnabled:
        body.moduleTextEnabled !== undefined ? Boolean(body.moduleTextEnabled) : undefined,
      moduleGalleryEnabled:
        body.moduleGalleryEnabled !== undefined ? Boolean(body.moduleGalleryEnabled) : undefined,
      folderText: body.folderText !== undefined ? String(body.folderText) : undefined,
    })
    return NextResponse.json({ folder })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await requireAuth(req)
  if (unauth) return unauth

  const { id } = await params

  try {
    await deleteFolder(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
