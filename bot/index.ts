import TelegramBot from 'node-telegram-bot-api'
import Anthropic from '@anthropic-ai/sdk'
import { Pool } from 'pg'

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const ALLOWED_USER_IDS = (process.env.TELEGRAM_ALLOWED_USER_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const MAX_HISTORY = 20

interface DbMessage {
  role: 'user' | 'assistant'
  content: string
}

async function getHistory(chatId: number): Promise<Anthropic.MessageParam[]> {
  const res = await pool.query<DbMessage>(
    `SELECT role, content FROM telegram_messages
     WHERE chat_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [chatId, MAX_HISTORY],
  )
  return res.rows.map((r) => ({ role: r.role, content: r.content }))
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
      `Твой chat ID: \`${chatId}\`\nДобавь его в настройки → Автопроверка складских статусов.`,
      { parse_mode: 'MarkdownV2' },
    )
    return
  }

  if (text === '/help') {
    await bot.sendMessage(chatId, '/myid — получить свой chat ID\n/help — помощь')
    return
  }

  const history = await getHistory(chatId)
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: text },
  ]

  let reply: string
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system:
        'Ты — личный ассистент. Отвечай кратко и по делу.',
      messages,
    })
    reply =
      response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('') || '...'
  } catch (err) {
    console.error('Claude API error:', err)
    reply = 'Ошибка при обращении к Claude. Попробуй ещё раз.'
  }

  await bot.sendMessage(chatId, reply)
  await saveExchange(chatId, text, reply)
})

bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message)
})

console.log('Telegram bot started (long polling)')
