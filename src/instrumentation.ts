export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { runMigrations } = await import('@/lib/db/runMigrations')
  try {
    const applied = await runMigrations()
    if (applied.length) {
      console.log('[migrations] applied:', applied.join(', '))
    }
  } catch (err) {
    console.error('[migrations] startup failed:', err)
  }
}
