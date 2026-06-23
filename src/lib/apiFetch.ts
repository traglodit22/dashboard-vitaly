// Обёртка над fetch с опциональным таймаутом (чтобы UI не зависал бесконечно).
export async function apiFetch(
  input: string,
  init: RequestInit = {},
  timeoutMs = 0,
): Promise<Response> {
  if (!timeoutMs) return fetch(input, init)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return apiFetch(input, init, timeoutMs)
}
