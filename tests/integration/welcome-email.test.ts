import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetchMock, rows, truncateAll } from './harness.ts'

const progressApi = (await import(new URL('../../netlify/functions/onboarding-progress.mts', import.meta.url).href)).default

const USER = 'amina@riverbend.example'
const SUPER = 'fabbiochucho@gmail.com'

async function progress(email: string, body: unknown) {
  ;(globalThis as any).__craftTestIdentity = { email, name: 'Amina Bello' }
  return progressApi(new Request('http://localhost/api/onboarding-progress', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })) as Promise<Response>
}

const resendCalls = (mock: ReturnType<typeof installFetchMock>) => mock.calls.filter((c) => c.url.includes('api.resend.com'))

describe('welcome email on onboarding completion', () => {
  let mock: ReturnType<typeof installFetchMock>
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country) VALUES('org_rb','Riverbend Trust','Nigeria')`)
    await rows(`INSERT INTO users(id,email,name,org_id,role) VALUES('u1','${USER}','Amina Bello','org_rb','admin')`)
    process.env.RESEND_API_KEY = 'test-key'
    process.env.INVITE_FROM_EMAIL = 'CRAFT <hello@mail.example.org>'
    process.env.APP_URL = 'https://craft.example'
    mock = installFetchMock()
  })
  afterEach(() => {
    mock.restore()
    delete process.env.RESEND_API_KEY
    delete process.env.INVITE_FROM_EMAIL
    delete process.env.APP_URL
  })

  it('sends once, to the person themselves, when onboarding is first completed', async () => {
    assert.equal((await progress(USER, { step: 2 })).status, 200)
    assert.equal(resendCalls(mock).length, 0, 'not before completion')
    assert.equal((await progress(USER, { step: 3, completed: true })).status, 200)
    const calls = resendCalls(mock)
    assert.equal(calls.length, 1)
    const body = JSON.parse(String(calls[0].init?.body))
    assert.equal(body.to, USER)
    assert.equal(body.subject, 'Welcome to CRAFT, Amina')
    assert.equal(body.reply_to, 'craftframework@becomechange.institute')
    assert.ok(body.html.includes('Riverbend Trust’s workspace') && body.html.includes('signature-abiola-pauline.png'))
    assert.equal((calls[0].init?.headers as Record<string, string>)['Idempotency-Key'], `welcome-${USER}`)
    const [row] = await rows(`SELECT welcome_email_sent_at, welcome_email_outcome FROM onboarding_progress WHERE email=$1`, [USER])
    assert.ok(row.welcome_email_sent_at)
    assert.equal(row.welcome_email_outcome, 'accepted')
    assert.equal((await rows(`SELECT 1 FROM audit_logs WHERE action='welcome email accepted' AND target=$1`, [USER])).length, 1)

    // Completing again (or saving again) never resends.
    assert.equal((await progress(USER, { step: 3, completed: true })).status, 200)
    assert.equal((await progress(USER, { step: 1 })).status, 200)
    assert.equal(resendCalls(mock).length, 1)
  })

  it('skips the platform Super Admin', async () => {
    assert.equal((await progress(SUPER, { step: 3, completed: true })).status, 200)
    assert.equal(resendCalls(mock).length, 0)
  })

  it('never breaks onboarding when email is unconfigured or the provider fails', async () => {
    delete process.env.RESEND_API_KEY
    assert.equal((await progress(USER, { step: 3, completed: true })).status, 200)
    assert.equal((await rows(`SELECT welcome_email_outcome FROM onboarding_progress WHERE email=$1`, [USER]))[0].welcome_email_outcome, 'not_configured')

    await truncateAll()
    await rows(`INSERT INTO users(id,email,name,org_id,role) VALUES('u1','${USER}','Amina Bello','org_none','admin')`)
    process.env.RESEND_API_KEY = 'test-key'
    mock.restore()
    mock = installFetchMock(() => new Response('boom', { status: 500 }))
    assert.equal((await progress(USER, { step: 3, completed: true })).status, 200)
    const [row] = await rows(`SELECT welcome_email_outcome FROM onboarding_progress WHERE email=$1`, [USER])
    assert.equal(row.welcome_email_outcome, 'failed')
    // No organisation record: the email still goes out with the fallback wording.
    assert.ok(JSON.parse(String(resendCalls(mock)[0].init?.body)).text.includes('your organisation’s workspace'))
  })
})
