import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, gt, lt } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { actionTemplates, ccaAssessments, copilotRequests, organizations, telegramLinkCodes, telegramLinks, users } from '../../db/schema.js'
import { isSuperAdmin, mfaRequired, resolveCaller, unauthorized, forbidden } from '../lib/auth.js'
import { encryptField } from '../lib/crypto.js'
import { logger, monitored } from '../lib/logger.js'
import { linkedEmail, sendTelegram, telegramApi, telegramConfigured } from '../lib/telegram.js'
import { retrieve, type ActionTemplate } from '../../src/lib/copilot.js'
import { screenProblems, type QuickScreen } from '../../src/lib/cca/quickScreen.js'
import { applyScreenAnswer, HELP, nextScreenStep, parseCommand } from '../../src/lib/telegramBot.js'

// /api/telegram/webhook  POST  Telegram updates (checked against TELEGRAM_WEBHOOK_SECRET)
// /api/telegram/link     GET   is this account linked?  POST  a one-time link code  DELETE  unlink every chat
// /api/telegram/setup    POST  super admin: point the bot's webhook at this site
const CODE_MINUTES = 15
const hash = (code: string) => createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

function secretMatches(given: string | null): boolean {
  const want = process.env.TELEGRAM_WEBHOOK_SECRET ?? ''
  if (!want || !given) return false
  const a = Buffer.from(given), b = Buffer.from(want)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function quickScreen(): Promise<QuickScreen | null> {
  const s = await getStore('cca-private').get('screen', { type: 'json' }) as QuickScreen | null
  return s && !screenProblems(s).length ? s : null
}

async function account(email: string) {
  const [u] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.email, email))
  const [org] = u?.orgId ? await db.select({ archetype: organizations.archetype, country: organizations.country }).from(organizations).where(eq(organizations.id, u.orgId)) : []
  return { orgId: u?.orgId ?? null, archetype: org?.archetype ?? '', country: org?.country ?? '' }
}

async function onMessage(chatId: string, text: string) {
  const cmd = parseCommand(text)
  const email = await linkedEmail(chatId)
  if (cmd.name === 'start' && cmd.arg) {
    const [code] = await db.delete(telegramLinkCodes).where(and(eq(telegramLinkCodes.codeHash, hash(cmd.arg)), gt(telegramLinkCodes.expiresAt, new Date()))).returning()
    if (!code) return sendTelegram(chatId, 'That link code has expired or was already used. In CRAFT, open Settings → Telegram for a new one.')
    await db.insert(telegramLinks).values({ chatId, email: code.email }).onConflictDoUpdate({ target: telegramLinks.chatId, set: { email: code.email, linkedAt: new Date(), state: null } })
    return sendTelegram(chatId, `Linked to your CRAFT account. CRAFT notices will also come here.\n\n${HELP}`)
  }
  if (!email) return sendTelegram(chatId, `${HELP}\n\nFirst link this chat: in CRAFT, open Settings → Telegram and follow the link there.`)
  if (cmd.name === 'stop') {
    await db.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId))
    return sendTelegram(chatId, 'Unlinked. CRAFT will not send anything more to this chat.')
  }
  if (cmd.name === 'help' || cmd.name === 'start' || cmd.name === 'unknown') return sendTelegram(chatId, HELP)
  if (cmd.name === 'status') {
    const me = await account(email)
    const drafts = me.orgId ? await db.select({ id: ccaAssessments.id, module: ccaAssessments.module, year: ccaAssessments.year }).from(ccaAssessments).where(and(eq(ccaAssessments.orgId, me.orgId), eq(ccaAssessments.status, 'draft'))) : []
    const answered = await db.select({ id: copilotRequests.id, domainName: copilotRequests.domainName }).from(copilotRequests).where(and(eq(copilotRequests.askedBy, email), eq(copilotRequests.status, 'answered'))).orderBy(desc(copilotRequests.id)).limit(5)
    return sendTelegram(chatId, [
      drafts.length ? `Capacity assessments still open: ${drafts.map((d) => `${d.module} ${d.year}`).join(', ')}.` : 'No capacity assessment is open.',
      answered.length ? `Expert answers: ${answered.map((a) => a.domainName).join('; ')}. Read them in CRAFT.` : 'No expert answers waiting.',
    ].join('\n'))
  }
  if (cmd.name === 'screen') {
    const s = await quickScreen()
    if (!s) return sendTelegram(chatId, 'The quick screen is not available yet.')
    const state = { answers: {} }
    await db.update(telegramLinks).set({ state }).where(eq(telegramLinks.chatId, chatId))
    const step = nextScreenStep(s, state)
    return sendTelegram(chatId, step.text, step.done ? undefined : step.buttons)
  }
  // A question: approved guidance if the library covers it, otherwise a CRAFT expert replies in this chat.
  if (!cmd.arg) return sendTelegram(chatId, 'Write your question after /ask, for example: /ask How should we run a tender?')
  const me = await account(email)
  const approved = (await db.select().from(actionTemplates).where(eq(actionTemplates.status, 'approved'))) as ActionTemplate[]
  const found = retrieve(approved, { domainId: '', domainName: cmd.arg, archetype: me.archetype, country: me.country })
  if (found.length) {
    return sendTelegram(chatId, `Approved CRAFT guidance that covers this:\n${found.map((t) => `• ${t.title} (${t.source})`).join('\n')}\n\nIn CRAFT, open the Capacity Assessment and choose "Draft a starting point" on that area to adapt it for your organisation.`)
  }
  await db.insert(copilotRequests).values({ orgId: me.orgId ?? '', askedBy: email, module: 'telegram', domainId: 'question', domainName: cmd.arg.slice(0, 200), note: encryptField(cmd.arg.slice(0, 1000)), status: 'routed', telegramChatId: chatId })
  return sendTelegram(chatId, 'No approved guidance covers this yet, so a CRAFT expert will reply here.')
}

async function onButton(chatId: string, callbackId: string, data: string) {
  await telegramApi('answerCallbackQuery', { callback_query_id: callbackId })
  const [link] = await db.select().from(telegramLinks).where(eq(telegramLinks.chatId, chatId))
  const s = await quickScreen()
  if (!link?.state || !s) return sendTelegram(chatId, 'Start the screen again with /screen.')
  const state = applyScreenAnswer(s, link.state, data)
  if (!state) return
  const step = nextScreenStep(s, state)
  await db.update(telegramLinks).set({ state: step.done ? null : state }).where(eq(telegramLinks.chatId, chatId))
  return sendTelegram(chatId, step.text, step.done ? undefined : step.buttons)
}

const handleRequest = async (req: Request) => {
  const sub = new URL(req.url).pathname.replace(/^\/api\/telegram\/?/, '')
  if (sub === 'webhook' && req.method === 'POST') {
    if (!secretMatches(req.headers.get('x-telegram-bot-api-secret-token'))) return new Response('Forbidden', { status: 403 })
    try {
      const update = await req.json()
      if (update.message?.chat?.id && typeof update.message.text === 'string') await onMessage(String(update.message.chat.id), update.message.text)
      else if (update.callback_query?.message?.chat?.id) await onButton(String(update.callback_query.message.chat.id), update.callback_query.id, String(update.callback_query.data ?? ''))
    } catch (error) {
      logger.error('telegram', 'update failed', error)
    }
    // Always 200: otherwise Telegram retries the same update.
    return new Response('ok')
  }
  try {
    const caller = await resolveCaller()
    if (!caller) return unauthorized()
    const mfaBlock = await mfaRequired(req, caller)
    if (mfaBlock) return mfaBlock
    const email = caller.email.toLowerCase()
    if (sub === 'link' && req.method === 'GET') {
      const linked = await db.select({ chatId: telegramLinks.chatId }).from(telegramLinks).where(eq(telegramLinks.email, email))
      return json({ configured: telegramConfigured(), bot: process.env.TELEGRAM_BOT_USERNAME ?? null, linked: linked.length })
    }
    if (sub === 'link' && req.method === 'POST') {
      if (!telegramConfigured() || !process.env.TELEGRAM_BOT_USERNAME) return json({ error: 'Telegram is not set up yet.' }, 503)
      await db.delete(telegramLinkCodes).where(lt(telegramLinkCodes.expiresAt, new Date()))
      const code = randomBytes(6).toString('hex').toUpperCase()
      const expiresAt = new Date(Date.now() + CODE_MINUTES * 60_000)
      await db.insert(telegramLinkCodes).values({ codeHash: hash(code), email, expiresAt })
      return json({ code, expiresAt, url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${code}` })
    }
    if (sub === 'link' && req.method === 'DELETE') {
      await db.delete(telegramLinks).where(eq(telegramLinks.email, email))
      return json({ ok: true })
    }
    if (sub === 'setup' && req.method === 'POST') {
      if (!isSuperAdmin(caller.email)) return forbidden()
      if (!process.env.TELEGRAM_WEBHOOK_SECRET) return json({ error: 'Set TELEGRAM_WEBHOOK_SECRET first.' }, 400)
      const site = process.env.URL ?? process.env.APP_URL ?? new URL(req.url).origin
      const ok = await telegramApi('setWebhook', { url: `${site}/api/telegram/webhook`, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query'] })
      return json({ ok }, ok ? 200 : 502)
    }
    return json({ error: 'Not found' }, 404)
  } catch (error) {
    logger.error('telegram', 'request failed', error)
    return json({ error: 'Telegram is unavailable right now.' }, 500)
  }
}

export const config: Config = { path: ['/api/telegram/*'] }
export default monitored(handleRequest)
