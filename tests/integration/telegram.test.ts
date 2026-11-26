import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { blobStores, installFetchMock, rows, truncateAll } from './harness.ts'

const telegram = (await import(new URL('../../netlify/functions/telegram.mts', import.meta.url).href)).default
const copilot = (await import(new URL('../../netlify/functions/copilot.mts', import.meta.url).href)).default
const { notify } = await import(new URL('../../netlify/lib/validation-lifecycle.ts', import.meta.url).href)
const USER = 'lead@org.example'
const CURATOR = 'curator@becomechange.example'

const as = (email: string | null) => { (globalThis as any).__craftTestIdentity = email ? { email, name: email } : null }
async function api(email: string | null, method: string, path: string, body?: unknown, h: (r: Request) => Promise<Response> = telegram, base = '/api/telegram') {
  as(email)
  const res = await h(new Request(`http://localhost${base}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
  return { status: res.status, body: await res.json().catch(() => null) }
}
const update = (u: unknown, secret = 'hook-secret') => telegram(new Request('http://localhost/api/telegram/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify(u) }))
const say = (text: string) => update({ message: { chat: { id: 42 }, text } })
const sentTexts = (m: ReturnType<typeof installFetchMock>) => m.calls.filter((c) => c.url.endsWith('/sendMessage')).map((c) => JSON.parse(String(c.init?.body)))

describe('Telegram channel', () => {
  let mock: ReturnType<typeof installFetchMock>
  beforeEach(async () => {
    await truncateAll()
    Object.assign(process.env, { TELEGRAM_BOT_TOKEN: 'bot-token', TELEGRAM_WEBHOOK_SECRET: 'hook-secret', TELEGRAM_BOT_USERNAME: 'CraftBot', COPILOT_CURATORS: CURATOR })
    await rows("INSERT INTO organizations(id,name,country,archetype) VALUES('org1','Org','KE','Private')")
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('u1','${USER}','org1','admin')`)
    mock = installFetchMock(() => new Response(JSON.stringify({ ok: true })))
  })
  afterEach(() => mock.restore())

  it('rejects updates without the webhook secret', async () => {
    assert.equal((await update({ message: { chat: { id: 42 }, text: '/help' } }, 'wrong')).status, 403)
    assert.equal(sentTexts(mock).length, 0)
  })

  it('links a chat with a one-time code, answers from approved guidance, and routes the rest to an expert who replies in the chat', async () => {
    await say('/status')
    assert.match(sentTexts(mock)[0].text, /First link this chat/, 'unlinked chats only get help')
    const link = await api(USER, 'POST', '/link')
    assert.match(link.body.url, /^https:\/\/t\.me\/CraftBot\?start=/)
    await say(`/start ${link.body.code}`)
    assert.match(sentTexts(mock).at(-1).text, /Linked to your CRAFT account/)
    await say(`/start ${link.body.code}`)
    assert.match(sentTexts(mock).at(-1).text, /expired or was already used/, 'a code works once')
    assert.equal((await api(USER, 'GET', '/link')).body.linked, 1)

    await say('How do we run a tender for staff appraisal?')
    assert.match(sentTexts(mock).at(-1).text, /a CRAFT expert will reply here/)
    const queue = await api(CURATOR, 'GET', '/queue', undefined, copilot, '/api/copilot')
    assert.equal(queue.body.length, 1)
    await api(CURATOR, 'POST', `/queue/${queue.body[0].id}/answer`, { answer: 'Use a scored, three-person panel and keep the score sheets.' }, copilot, '/api/copilot')
    const reply = sentTexts(mock).at(-1)
    assert.equal(reply.chat_id, '42')
    assert.match(reply.text, /three-person panel/)

    // Email notices also reach the linked chat.
    await notify([USER], 'CRAFT: the debrief is open', 'Sign in to respond.')
    assert.match(sentTexts(mock).at(-1).text, /the debrief is open/)

    await say('/stop')
    assert.equal((await api(USER, 'GET', '/link')).body.linked, 0)
  })

  it('runs the quick screen with buttons and does not save it as a record', async () => {
    blobStores().set('cca-private', new Map([['screen', { bytes: Buffer.from(JSON.stringify({ name: 'Quick', sections: [{ id: 's', name: 'S', questions: [
      { id: 'q1', text: 'Do you have audited accounts?', kind: 'yes_no' }, { id: 'q2', text: 'Is there a finance manual?', kind: 'yes_no' },
    ] }] })) }]]))
    const { code } = (await api(USER, 'POST', '/link')).body
    await say(`/start ${code}`)
    await say('/screen')
    const first = sentTexts(mock).at(-1)
    assert.match(first.text, /^1\/2\. Do you have audited accounts\?/)
    const press = (data: string) => update({ callback_query: { id: 'cb', data, message: { chat: { id: 42 } } } })
    await press(first.reply_markup.inline_keyboard[0][0].callback_data)
    await press('s:1:0')
    assert.match(sentTexts(mock).at(-1).text, /Eligible, with minimal support \(100%\)/)
    assert.equal((await rows('SELECT state FROM telegram_links'))[0].state, null)
    assert.equal((await rows("SELECT 1 FROM information_schema.tables WHERE table_name='cca_screens'")).length ? (await rows('SELECT 1 FROM cca_screens')).length : 0, 0)
  })
})
