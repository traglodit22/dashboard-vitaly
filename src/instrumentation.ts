export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { ensureDashboardUsers } = await import('@/lib/auth/ensureUsers')
  try {
    await ensureDashboardUsers()
  } catch (err) {
    console.error('[auth] startup users seed failed:', err)
  }

  const { ensureHotelProcurement } = await import('@/lib/procurement/ensureHotelSeed')
  try {
    await ensureHotelProcurement()
  } catch (err) {
    console.error('[procurement] startup seed failed:', err)
  }

  const { ensureFilesSeed } = await import('@/lib/files/ensureFilesSeed')
  try {
    await ensureFilesSeed()
  } catch (err) {
    console.error('[files] startup seed failed:', err)
  }

  const { ensureFunkoSchema } = await import('@/lib/funko/ensureFunko')
  try {
    await ensureFunkoSchema()
  } catch (err) {
    console.error('[funko] startup schema failed:', err)
  }
}
