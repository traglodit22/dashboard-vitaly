// Тонкая обёртка над fetch. Куки отправляются браузером автоматически (same-origin).
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, init)
}
