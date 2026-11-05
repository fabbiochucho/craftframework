import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { installFetchMock, rows, truncateAll } from './harness.ts'

const api = (await import(new URL('../../netlify/functions/screening.mts', import.meta.url).href)).default
const ALICE = 'alice@org-a.example'
const BOB = 'bob@org-b.example'

async function call(email: string | null, method: string, path = '', body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email, name: email } : null
  const res: Response = await api(new Request(`http://localhost/api/screening${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
  const text = await res.text()
  let parsed: any = null
  try { parsed = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: parsed }
}

describe('exclusion, debarment and sanctions screening', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country) VALUES('org_a','Riverbend','Kenya'),('org_b','Hidden Trust','Kenya')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
  })
  afterEach(() => { delete process.env.OPENSANCTIONS_API_KEY })

  it('is off until a provider key is set, then flags possible matches for a person to review', async () => {
    const subjects = [{ name: 'Riverbend Trust', type: 'organisation', country: 'ke' }, { name: 'Musa Bello', type: 'person' }]
    assert.equal((await call(ALICE, 'POST', '', { orgId: 'org_a', subjects })).status, 503, 'not switched on')
    assert.equal((await call(ALICE, 'GET', '?orgId=org_a')).body.configured, false)

    process.env.OPENSANCTIONS_API_KEY = 'test-key-not-a-credential'
    const mock = installFetchMock((c) => {
      const body = JSON.parse(String(c.init?.body))
      assert.equal((c.init?.headers as any).Authorization, 'ApiKey test-key-not-a-credential')
      assert.deepEqual(Object.keys(body.queries), ['q0', 'q1'])
      assert.equal(body.queries.q1.schema, 'Person')
      return new Response(JSON.stringify({ responses: {
        q0: { results: [{ id: 'x1', caption: 'Riverbend Holdings', score: 0.42, datasets: ['us_ofac_sdn'] }] },
        q1: { results: [{ id: 'x2', caption: 'Musa Bello', score: 0.93, datasets: ['worldbank_debarred'] }] },
      } }), { status: 200 })
    })
    let r
    try { r = await call(ALICE, 'POST', '', { orgId: 'org_a', subjects }) } finally { mock.restore() }
    assert.equal(r.status, 201)
    assert.equal(mock.calls[0].url, 'https://api.opensanctions.org/match/default')
    assert.deepEqual(r.body.results.map((x: any) => [x.subjectName, x.status]), [['Riverbend Trust', 'clear'], ['Musa Bello', 'possible_match']])
    assert.deepEqual(r.body.results[0].matches, [], 'below-threshold results are not kept as matches')

    let view = (await call(ALICE, 'GET', '?orgId=org_a')).body
    assert.equal(view.state, 'needs_review')
    const match = view.results.find((x: any) => x.status === 'possible_match')
    assert.equal((await call(BOB, 'PUT', `/${match.id}`, { review: 'false_positive', note: 'Different person' })).status, 403)
    assert.equal((await call(ALICE, 'PUT', `/${match.id}`, { review: 'false_positive' })).status, 400, 'a reason is required')
    assert.equal((await call(ALICE, 'PUT', `/${view.results.find((x: any) => x.status === 'clear').id}`, { review: 'false_positive', note: 'x x x' })).status, 400, 'clear results need no review')
    assert.equal((await call(ALICE, 'PUT', `/${match.id}`, { review: 'false_positive', note: 'Different date of birth and country' })).status, 200)
    view = (await call(ALICE, 'GET', '?orgId=org_a')).body
    assert.equal(view.state, 'clear')
    assert.equal((await call(BOB, 'GET', '?orgId=org_a')).status, 403)

    // Provider failure is recorded as an error, never as clear.
    const down = installFetchMock(() => new Response('{}', { status: 500 }))
    try { r = await call(ALICE, 'POST', '', { orgId: 'org_a', subjects: [{ name: 'Amina Okoro', type: 'person' }] }) } finally { down.restore() }
    assert.equal(r.status, 502)
    assert.equal(r.body.results[0].status, 'error')
    const audit = await rows(`SELECT action FROM audit_logs WHERE org_id='org_a' ORDER BY id`)
    assert.ok(audit.some((a) => /Screened 2 name\(s\): 1 possible match/.test(a.action)) && audit.some((a) => /false_positive/.test(a.action)))
  })
})
