import { query } from '@/lib/db/index'
import { fetch as undiciFetch, ProxyAgent } from 'undici'

async function getBotToken(): Promise<string> {
  const rows = await query<{ telegram_bot_token: string | null }>(
    'SELECT telegram_bot_token FROM system_settings WHERE id = 1',
  )
  const token =
    rows[0]?.telegram_bot_token?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) {
    throw new Error(
      'Telegram bot token не задан — укажите в Настройках или TELEGRAM_BOT_TOKEN',
    )
  }
  return token
}

function getProxyUrl(): string | undefined {
  return (
    process.env.TELEGRAM_PROXY_URL?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    undefined
  )
}

async function telegramFetch(url: string, init?: RequestInit): Promise<Response> {
  const proxy = getProxyUrl()
  const attempts = proxy ? 3 : 1
  let lastErr: unknown

  for (let i = 0; i < attempts; i++) {
    try {
      if (!proxy) return await fetch(url, init)
      const dispatcher = new ProxyAgent(proxy)
      return (await undiciFetch(url, {
        method: init?.method,
        headers: init?.headers,
        body: init?.body as string | undefined,
        dispatcher,
      })) as unknown as Response
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)))
    }
  }

  throw lastErr
}

// Escape chars that are literal in MarkdownV2 context (not inside formatting)
function escapeMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!\-\\]/g, '\\$&')
}

// Escape chars inside code spans/blocks (only ` and \ need escaping there)
function escapeCode(text: string): string {
  return text.replace(/[`\\]/g, '\\$&')
}

// Convert standard Markdown (Claude output) → Telegram MarkdownV2
function toMarkdownV2(input: string): string {
  let result = ''
  let i = 0

  while (i < input.length) {
    // Fenced code block ```lang?\ncode\n```
    if (input.startsWith('```', i)) {
      const closeIdx = input.indexOf('```', i + 3)
      if (closeIdx !== -1) {
        const inner = input.slice(i + 3, closeIdx)
        const newline = inner.indexOf('\n')
        // strip optional language tag on first line
        const code = newline >= 0 ? inner.slice(newline + 1) : inner
        result += '```' + escapeCode(code.replace(/\n$/, '')) + '```'
        i = closeIdx + 3
        continue
      }
    }

    // Inline code `code`
    if (input[i] === '`') {
      const closeIdx = input.indexOf('`', i + 1)
      if (closeIdx !== -1) {
        result += '`' + escapeCode(input.slice(i + 1, closeIdx)) + '`'
        i = closeIdx + 1
        continue
      }
    }

    // Bold **text** → *text*
    if (input.startsWith('**', i)) {
      const closeIdx = input.indexOf('**', i + 2)
      if (closeIdx !== -1) {
        result += '*' + escapeMd(input.slice(i + 2, closeIdx)) + '*'
        i = closeIdx + 2
        continue
      }
    }

    // Headers ## text → *text*
    if (input[i] === '#' && (i === 0 || input[i - 1] === '\n')) {
      const m = input.slice(i).match(/^#{1,6} +(.+)/)
      if (m) {
        result += '*' + escapeMd(m[1]) + '*'
        i += m[0].length
        continue
      }
    }

    // List item "- " or "* " at line start → "• "
    if ((input[i] === '-' || input[i] === '*') && input[i + 1] === ' ' && (i === 0 || input[i - 1] === '\n')) {
      result += '•'
      i += 1 // keep the space
      continue
    }

    // Everything else: escape if needed
    const ch = input[i]
    if ('_*[]()~`>#+=|{}.!\\-'.includes(ch)) {
      result += '\\' + ch
    } else {
      result += ch
    }
    i++
  }

  return result
}

export async function sendMessage(chatId: string | number, text: string) {
  try {
    const token = await getBotToken()
    const api = `https://api.telegram.org/bot${token}`
    const mdv2 = toMarkdownV2(text)

    let res = await telegramFetch(`${api}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: mdv2, parse_mode: 'MarkdownV2' }),
    })

    if (!res.ok) {
      res = await telegramFetch(`${api}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      })
    }

    const data = await res.json()
    if (!res.ok || !data.ok) {
      console.error('Telegram sendMessage failed:', { chatId, status: res.status, data })
    }
    return data
  } catch (err) {
    console.error('Telegram sendMessage error:', { chatId, err })
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function setWebhook(url: string) {
  const token = await getBotToken()
  const res = await telegramFetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    }),
  })
  return res.json()
}
