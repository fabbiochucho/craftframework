import { eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { telegramLinks } from '../../db/schema.js'
import { clip, type Button } from '../../src/lib/telegramBot.js'
import { logger } from './logger.js'

// Sending to Telegram (Bot API over HTTPS). TELEGRAM_BOT_TOKEN unset means the channel is off and nothing is sent.
// ponytail: lives in CRAFT for now; move to a shared messaging service when DevMapper and the other platforms need it.
export const telegramConfigured = () => !!process.env.TELEGRAM_BOT_TOKEN

export async function telegramApi(method: string, body: unknown): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) logger.warn('telegram', `${method} failed`, { status: res.status })
    return res.ok
  } catch (error) {
    logger.error('telegram', `${method} failed`, error)
    return false
  }
}

export const sendTelegram = (chatId: string, text: string, buttons?: Button[][]) =>
  telegramApi('sendMessage', { chat_id: chatId, text: clip(text), ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}) })

/** Also send a notice CRAFT emails to everyone with a linked chat. Never fails the caller. */
export async function notifyTelegram(emails: string[], subject: string, text: string): Promise<number> {
  if (!telegramConfigured() || !emails.length) return 0
  try {
    const chats = await db.select({ chatId: telegramLinks.chatId }).from(telegramLinks).where(inArray(telegramLinks.email, emails.map((e) => e.toLowerCase())))
    const sent = await Promise.all(chats.map((c) => sendTelegram(c.chatId, `${subject}\n\n${text}`)))
    return sent.filter(Boolean).length
  } catch (error) {
    logger.error('telegram', 'notice failed', error)
    return 0
  }
}

export async function linkedEmail(chatId: string): Promise<string | null> {
  const [row] = await db.select({ email: telegramLinks.email }).from(telegramLinks).where(eq(telegramLinks.chatId, chatId))
  return row?.email ?? null
}
