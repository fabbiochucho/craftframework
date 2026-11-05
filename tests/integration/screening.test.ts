import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { blobStores, installFetchMock, rows, truncateAll } from './harness.ts'

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

// Fixture lists in the stored shape (the official-lists refresh writes the same).
const entry = (source: string, id: string, type: string, names: string[], countries: string[] = [], birthYears: number[] = [], ids: string[] = []) => ({ source, id, type, names, countries, birthYears, ids })
const seedLists = () => blobStores().set('screening-lists', new Map([
  ['ofac', { bytes: Buffer.from(JSON.stringify({ fetchedAt: new Date().toISOString(), count: 2, entries: [
    entry('ofac', '100', 'person', ['BELLO, Musa'], ['nigeria'], [1970]),
    entry('ofac', '101', 'person', ['OKORO, Amina'], [], []),
  ] })) }],
  ['uk', { bytes: Buffer.from(JSON.stringify({ fetchedAt: new Date().toISOString(), count: 1, entries: [
    entry('uk', 'UK2', 'organisation', ['Riverline Trading Ltd'], ['kenya'], [], ['C-99/2020']),
  ] })) }],
]))

describe('free official-list screening with automatic review', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country) VALUES('org_a','Riverbend','Kenya'),('org_b','Hidden Trust','Kenya')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
  })
  afterEach(() => { delete process.env.OPENSANCTIONS_API_KEY })

  it('settles clear cases automatically, sends ambiguous ones to a person, and records manual debarment checks', async () => {
    assert.equal((await call(ALICE, 'POST', '', { orgId: 'org_a', subjects: [{ name: 'Musa Bello', type: 'person' }] })).status, 503, 'lists not downloaded yet')
    seedLists()
    const r = await call(ALICE, 'POST', '', { orgId: 'org_a', subjects: [
      { name: 'Musa Bello', type: 'person', country: 'ng' },            // exact name + same country: confirmed
      { name: 'Riverline Trading', type: 'organisation', country: 'ug' }, // different country: dismissed
      { name: 'Amina Okoro', type: 'person' },                           // name only: a person decides
      { name: 'Riverbend Community Trust', type: 'organisation' },       // no match: clear
    ] })
    assert.equal(r.status, 201)
    const by = Object.fromEntries(r.body.results.map((x: any) => [x.subjectName, x]))
    assert.deepEqual([by['Musa Bello'].review, by['Musa Bello'].reviewedBy], ['confirmed_match', 'system: automatic rules'])
    assert.match(by['Musa Bello'].reviewNote, /Exact name, same type and same country/)
    assert.equal(by['Riverline Trading'].review, 'false_positive')
    assert.match(by['Riverline Trading'].reviewNote, /Different country/)
    assert.deepEqual([by['Amina Okoro'].status, by['Amina Okoro'].review ?? ''], ['possible_match', ''])
    assert.equal(by['Riverbend Community Trust'].status, 'clear')

    let view = (await call(ALICE, 'GET', '?orgId=org_a')).body
    assert.deepEqual([view.provider, view.ready, view.state], ['official-lists', true, 'confirmed_match'])
    assert.deepEqual(view.lists.map((l: any) => [l.source, l.count]), [['un', 0], ['ofac', 2], ['eu', 0], ['uk', 1]])

    // A person overturns the automatic confirmation (e.g. different person with the same name) and decides the open one.
    const musa = view.results.find((x: any) => x.subjectName === 'Musa Bello')
    assert.equal((await call(BOB, 'PUT', `/${musa.id}`, { review: 'false_positive', note: 'x x x' })).status, 403)
    assert.equal((await call(ALICE, 'PUT', `/${musa.id}`, { review: 'false_positive', note: 'Passport shows a different date of birth' })).status, 200)
    const amina = view.results.find((x: any) => x.subjectName === 'Amina Okoro')
    assert.equal((await call(ALICE, 'PUT', `/${amina.id}`, { review: 'false_positive', note: 'Our board member is a different person (ID checked)' })).status, 200)
    view = (await call(ALICE, 'GET', '?orgId=org_a')).body
    assert.equal(view.state, 'clear')

    // Debarment lists with no free download: a person's check is recorded.
    assert.equal((await call(ALICE, 'POST', '/manual', { orgId: 'org_a', subjectName: 'Riverbend', subjectType: 'organisation', list: 'worldbank', result: 'clear', note: 'Searched 5 Nov 2026, no result' })).status, 201)
    assert.equal((await call(ALICE, 'POST', '/manual', { orgId: 'org_a', subjectName: 'Riverbend', subjectType: 'organisation', list: 'nope', result: 'clear', note: 'x x x' })).status, 400)
    view = (await call(ALICE, 'GET', '?orgId=org_a')).body
    assert.ok(view.results.some((x: any) => x.provider === 'manual:worldbank' && x.status === 'clear'))
    const audit = (await rows(`SELECT action FROM audit_logs WHERE org_id='org_a' ORDER BY id`)).map((a) => a.action)
    assert.ok(audit.some((a) => /1 confirmed automatically, 1 dismissed automatically, 1 for a person to review/.test(a)), audit.join('\n'))
    assert.ok(audit.some((a) => /Overturned automatic decision/.test(a)))
    assert.equal((await call(BOB, 'GET', '?orgId=org_a')).status, 403)
  })

  it('refreshes only lists older than six hours, reading just their dates', async () => {
    const { getStore } = await import('@netlify/blobs')
    const fresh = new Date().toISOString()
    for (const s of ['un', 'ofac', 'eu', 'uk']) await getStore('screening-lists').setJSON(s, { fetchedAt: fresh, count: 1, entries: [] }, { metadata: { fetchedAt: fresh } })
    const refresh = (await import(new URL('../../netlify/functions/screening-lists-refresh-background.mts', import.meta.url).href)).default
    const mock = installFetchMock(() => new Response('', { status: 500 }))
    try { await refresh() } finally { mock.restore() }
    assert.equal(mock.calls.length, 0, 'nothing downloaded: every list is fresh')
    await getStore('screening-lists').setJSON('uk', { fetchedAt: '2020-01-01T00:00:00Z', count: 1, entries: [] }, { metadata: { fetchedAt: '2020-01-01T00:00:00Z' } })
    const again = installFetchMock(() => new Response('', { status: 500 }))
    try { await refresh() } finally { again.restore() }
    assert.deepEqual(again.calls.map((c: any) => c.url), ['https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv'], 'only the stale list')
  })

  it('uses OpenSanctions only when a paid key is set, and records provider failures as errors', async () => {
    process.env.OPENSANCTIONS_API_KEY = 'test-key-not-a-credential'
    const mock = installFetchMock(() => new Response(JSON.stringify({ responses: { q0: { results: [{ id: 'x', caption: 'Musa Bello', score: 0.93, datasets: ['worldbank_debarred'] }] } } }), { status: 200 }))
    let r
    try { r = await call(ALICE, 'POST', '', { orgId: 'org_a', subjects: [{ name: 'Musa Bello', type: 'person' }] }) } finally { mock.restore() }
    assert.equal(mock.calls[0].url, 'https://api.opensanctions.org/match/default')
    assert.deepEqual([r.body.results[0].provider, r.body.results[0].status, r.body.results[0].review ?? ''], ['opensanctions', 'possible_match', ''])
    const down = installFetchMock(() => new Response('{}', { status: 500 }))
    try { r = await call(ALICE, 'POST', '', { orgId: 'org_a', subjects: [{ name: 'Amina Okoro', type: 'person' }] }) } finally { down.restore() }
    assert.deepEqual([r.status, r.body.results[0].status], [502, 'error'])
  })
})
