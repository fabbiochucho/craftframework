import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetchMock, rows, truncateAll } from './harness.ts'

const handler = (await import(new URL('../../netlify/functions/copilot.mts', import.meta.url).href)).default
const ADMIN1 = 'curator@becomechange.example'
const ADMIN2 = 'approver@becomechange.example'
const ORG = 'lead@org.example'

async function call(email: string | null, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email, name: email } : null
  const res: Response = await handler(new Request(`http://localhost/api/copilot${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
  return { status: res.status, body: await res.json() }
}
const TEMPLATE = { title: 'Procurement committee SOP', kind: 'sop', domains: ['fin.3'], keywords: ['procurement'], archetypes: [], countries: [], body: 'Step 1. Constitute a procurement committee of three. Step 2. Record every bid in the bid register. '.repeat(2), source: 'CRAFT template library v1' }
// A gateway reply in the Messages API shape: one cited text block.
const reply = (text: string, cited = true) => new Response(JSON.stringify({
  id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
  content: [{ type: 'text', text, citations: cited ? [{ type: 'char_location', cited_text: 'Record every bid in the bid register.', document_index: 0, document_title: 'Procurement committee SOP', start_char_index: 0, end_char_index: 10 }] : null }],
}), { headers: { 'content-type': 'application/json' } })

describe('Gap-to-Action Copilot', () => {
  let mock: ReturnType<typeof installFetchMock> | null = null
  beforeEach(async () => {
    await truncateAll()
    process.env.COPILOT_CURATORS = `${ADMIN1}, ${ADMIN2}`
    process.env.ANTHROPIC_BASE_URL = 'http://gateway.test'
    process.env.ANTHROPIC_API_KEY = 'test-key'
    process.env.COPILOT_ENABLED = 'true'
    await rows("INSERT INTO organizations(id,name,country,archetype) VALUES('org1','Org','KE','Private')")
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('u1','${ORG}','org1','admin')`)
  })
  afterEach(() => { mock?.restore(); mock = null; delete process.env.COPILOT_ENABLED })

  it('uses only templates a second person approved, and cites them', async () => {
    const created = await call(ADMIN1, 'POST', '/templates', TEMPLATE)
    assert.equal(created.status, 201)
    assert.equal((await call(ORG, 'POST', '/templates', TEMPLATE)).status, 403, 'organisations cannot add templates')
    assert.equal((await call(ADMIN1, 'POST', `/templates/${created.body.id}/approve`)).status, 409, 'the author cannot approve their own template')

    mock = installFetchMock(() => reply('should not be called'))
    const ask = { orgId: 'org1', module: 'pre_award', domainId: 'fin.3', domainName: 'Procurement' }
    const unapproved = await call(ORG, 'POST', '/draft', ask)
    assert.equal(unapproved.body.routed, true, 'an unapproved template is never used')
    assert.equal(mock.calls.length, 0, 'no model call without an approved template')

    assert.equal((await call(ADMIN2, 'POST', `/templates/${created.body.id}/approve`)).status, 200)
    mock.restore()
    mock = installFetchMock(() => reply('1. Form a procurement committee. 2. Keep a bid register.\n\nEvidence that this is in use: the bid register.'))
    const drafted = await call(ORG, 'POST', '/draft', { ...ask, note: 'We buy medical supplies' })
    assert.equal(drafted.status, 200, JSON.stringify(drafted.body))
    assert.equal(drafted.body.routed, false)
    assert.match(drafted.body.watermark, /not evidence/)
    assert.equal(drafted.body.citations[0].title, 'Procurement committee SOP')
    const sent = JSON.parse(String(mock.calls[0].init?.body))
    assert.equal(sent.model, 'claude-opus-5-5')
    assert.equal(sent.messages[0].content[0].type, 'document')
    assert.equal(sent.messages[0].content[0].citations.enabled, true)
    const [stored] = await rows("SELECT draft, note FROM copilot_requests WHERE status='drafted'")
    assert.ok(stored.draft.startsWith('enc:') || process.env.FIELD_ENCRYPTION_KEY === undefined)

    // Editing an approved template sends it back for approval.
    assert.equal((await call(ADMIN2, 'PUT', `/templates/${created.body.id}`, TEMPLATE)).body.status, 'draft')
  })

  it('routes uncovered or uncited answers to a human expert, who answers the organisation', async () => {
    const t = await call(ADMIN1, 'POST', '/templates', TEMPLATE)
    await call(ADMIN2, 'POST', `/templates/${t.body.id}/approve`)
    mock = installFetchMock(() => reply('NOT_COVERED', false))
    const ask = { orgId: 'org1', module: 'pre_award', domainId: 'fin.3', domainName: 'Procurement' }
    assert.equal((await call(ORG, 'POST', '/draft', ask)).body.routed, true)
    mock.restore()
    mock = installFetchMock(() => reply('An answer that cites nothing.', false))
    assert.equal((await call(ORG, 'POST', '/draft', ask)).body.routed, true, 'an uncited answer is not trusted')
    const queue = await call(ADMIN1, 'GET', '/queue')
    assert.equal(queue.body.length, 2)
    assert.equal((await call(ORG, 'GET', '/queue')).status, 403)
    assert.equal((await call(ADMIN1, 'POST', `/queue/${queue.body[0].id}/answer`, { answer: 'Use a three-person committee and a bid register.' })).status, 200)
    const mine = await call(ORG, 'GET', '/requests?orgId=org1')
    assert.ok(mine.body.requests.some((r: any) => r.status === 'answered' && r.answer.includes('bid register')))
  })

  it('stays off until switched on, and refuses other organisations', async () => {
    delete process.env.COPILOT_ENABLED
    const ask = { orgId: 'org1', module: 'pre_award', domainId: 'fin.3', domainName: 'Procurement' }
    assert.equal((await call(ORG, 'POST', '/draft', ask)).status, 503)
    process.env.COPILOT_ENABLED = 'true'
    await rows("INSERT INTO users(id,email,org_id,role) VALUES('u2','other@else.example','org2','admin')")
    assert.equal((await call('other@else.example', 'POST', '/draft', ask)).status, 403)
    assert.equal((await call(null, 'POST', '/draft', ask)).status, 401)
  })
})
