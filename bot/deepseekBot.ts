/**
 * Telegram-ассистент на DeepSeek (прод).
 * Токены — из system_settings; Telegram API — через privoxy (TELEGRAM_PROXY_URL).
 */
import TelegramBot from 'node-telegram-bot-api'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const PROXY =
  process.env.TELEGRAM_PROXY_URL?.trim() ||
  process.env.HTTPS_PROXY?.trim() ||
  'http://127.0.0.1:8118'

const ALLOWED_USER_IDS = (process.env.TELEGRAM_ALLOWED_USER_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const MAX_HISTORY = 20
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

interface DbMessage {
  role: 'user' | 'assistant'
  content: string
}

interface SettingsRow {
  telegram_bot_token: string | null
  deepseek_api_key: string | null
}

async function loadSettings(): Promise<SettingsRow> {
  const res = await pool.query<SettingsRow>(
    'SELECT telegram_bot_token, deepseek_api_key FROM system_settings WHERE id = 1',
  )
  return res.rows[0] ?? { telegram_bot_token: null, deepseek_api_key: null }
}

function tokenFromEnvOrDb(row: SettingsRow): string {
  return (
    row.telegram_bot_token?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    ''
  )
}

function deepseekKeyFromEnvOrDb(row: SettingsRow): string {
  return row.deepseek_api_key?.trim() || process.env.DEEPSEEK_API_KEY?.trim() || ''
}

async function getHistory(chatId: number): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const res = await pool.query<DbMessage>(
    `SELECT role, content FROM telegram_messages
     WHERE chat_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [chatId, MAX_HISTORY],
  )
  return res.rows
}

async function saveExchange(chatId: number, userText: string, assistantText: string) {
  const now = new Date()
  await pool.query(
    `INSERT INTO telegram_messages (chat_id, role, content, created_at) VALUES
     ($1, 'user', $2, $3),
     ($1, 'assistant', $4, $5)`,
    [chatId, userText, now, assistantText, new Date(now.getTime() + 1)],
  )
}

async function askDeepSeek(apiKey: string, messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 1024,
      messages: [{ role: 'system', content: 'Ты — личный ассистент. Отвечай кратко и по делу.' }, ...messages],
    }),
    signal: AbortSignal.timeout(60_000),
  })

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    error?: { message?: string }
  }

  if (!res.ok) {
    throw new Error(data.error?.message ?? `DeepSeek HTTP ${res.status}`)
  }

  return data.choices?.[0]?.message?.content?.trim() || '…'
}

function createBot(token: string): TelegramBot {
  return new TelegramBot(token, {
    polling: { interval: 1500, autoStart: false, params: { timeout: 30 } },
    request: { proxy: PROXY, timeout: 45_000 },
  })
}

async function main() {
  const settings = await loadSettings()
  const token = tokenFromEnvOrDb(settings)
  if (!token) {
    console.error('[bot] Telegram token не задан (system_settings или TELEGRAM_BOT_TOKEN)')
    process.exit(1)
  }

  let bot = createBot(token)
  let pollBackoffMs = 3000

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id
    const userId = msg.from?.id
    const text = msg.text?.trim()
    if (!text) return

    if (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(String(userId))) {
      await bot.sendMessage(chatId, 'У меня нет доступа к этому боту.')
      return
    }

    if (text === '/myid' || text === '/start') {
      await bot.sendMessage(
        chatId,
        `Твой chat ID: \`${chatId}\`\nДобавь его в настройки → уведомления.`,
        { parse_mode: 'MarkdownV2' },
      )
      return
    }

    if (text === '/help') {
      await bot.sendMessage(chatId, '/myid — chat ID\n/help — помощь')
      return
    }

    const fresh = await loadSettings()
    const dsKey = deepseekKeyFromEnvOrDb(fresh)
    if (!dsKey) {
      await bot.sendMessage(chatId, 'DeepSeek API key не настроен в панели.')
      return
    }

    const history = await getHistory(chatId)
    let reply: string
    try {
      reply = await askDeepSeek(dsKey, [...history, { role: 'user', content: text }])
    } catch (err) {
      console.error('[bot] DeepSeek error:', err)
      reply = 'Ошибка при обращении к DeepSeek. Попробуй ещё раз.'
    }

    await bot.sendMessage(chatId, reply)
    await saveExchange(chatId, text, reply)
  })

  async function startPolling() {
    try {
      await bot.startPolling()
      pollBackoffMs = 3000
      console.log(`[bot] started (DeepSeek from DB, proxy ${PROXY})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[bot] polling start error:', msg)
      setTimeout(startPolling, pollBackoffMs)
      pollBackoffMs = Math.min(pollBackoffMs * 2, 120_000)
    }
  }

  bot.on('polling_error', (err) => {
    console.error('[bot] polling error:', err.message)
    pollBackoffMs = Math.min(pollBackoffMs * 2, 120_000)
    bot.stopPolling().finally(() => {
      setTimeout(startPolling, pollBackoffMs)
    })
  })

  await startPolling()
}

main().catch((err) => {
  console.error('[bot] fatal:', err)
  process.exit(1)
})
