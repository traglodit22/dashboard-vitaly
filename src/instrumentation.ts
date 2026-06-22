export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { ensureHotelProcurement } = await import('@/lib/procurement/ensureHotelSeed')
  try {
    await ensureHotelProcurement()
  } catch (err) {
    console.error('[procurement] startup seed failed:', err)
  }
}
