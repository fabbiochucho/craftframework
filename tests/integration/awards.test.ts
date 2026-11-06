import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { blobStores, rows, truncateAll } from './harness.ts'

const api = (await import(new URL('../../netlify/functions/awards.mts', import.meta.url).href)).default

const ALICE = 'alice@org-a.example' // admin of org_a
const BOB = 'bob@org-b.example' // admin of org_b (outsider)
const FUNDER = 'grants@funder-one.example' // funder of award 1
const OTHER = 'officer@funder-two.example' // another funder, no award with org_a

async function call(email: string | null, method: string, path = '', body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email, name: email } : null
  const res: Response = await api(new Request(`http://localhost/api/awards${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
  const text = await res.text()
  let parsed: any = null
  try { parsed = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: parsed }
}

describe('awards, measures, issues and consented sharing', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id,name,country) VALUES('org_a','Riverbend','Kenya'),('org_b','Hidden Trust','Kenya')`)
    await rows(`INSERT INTO users(id,email,org_id,role) VALUES('a','${ALICE}','org_a','admin'),('b','${BOB}','org_b','admin')`)
  })

  it('runs an award from issues to close-out, and shares only what the organisation allows', async () => {
    assert.equal((await call(BOB, 'POST', '', { orgId: 'org_a', title: 'Health systems grant' })).status, 403)
    const aw = (await call(ALICE, 'POST', '', { orgId: 'org_a', title: 'Health systems grant', funderName: 'Funder One', funderEmail: FUNDER, value: 250000, currency: 'USD', modality: 'advance', startDate: '2026-01-01', endDate: '2026-12-31' })).body.id
    assert.ok(aw)
    const aw2 = (await call(ALICE, 'POST', '', { orgId: 'org_a', title: 'Education grant', funderEmail: OTHER })).body.id

    // The funder records a measure and raises a verified issue on its own award.
    const m = await call(FUNDER, 'POST', `/${aw}/measures`, { kind: 'reimbursement_only', description: 'Advances stopped until ageing is fixed', liftedWhen: 'Issue verified as fixed' })
    assert.equal(m.status, 201)
    assert.equal((await call(OTHER, 'POST', `/${aw}/measures`, { kind: 'suspension', description: 'Not my award' })).status, 403)
    const iss = (await call(FUNDER, 'POST', '/issues', { orgId: 'org_a', awardId: aw, source: 'funder_visit', type: 'financial', title: 'Advances not retired' })).body.id
    assert.equal((await call(OTHER, 'POST', '/issues', { orgId: 'org_a', awardId: aw, source: 'audit', type: 'financial', title: 'x x x' })).status, 403)
    assert.equal((await call(FUNDER, 'PUT', `/issues/${iss}`, { verified: true })).status, 200)
    assert.equal((await call(FUNDER, 'PUT', `/issues/${iss}`, { orgResponse: 'not theirs to write' })).status, 403, 'only the organisation writes its response')
    assert.equal((await call(ALICE, 'PUT', `/issues/${iss}`, { orgResponse: 'Ageing report introduced; 9 advances retired.' })).status, 200)
    // An unverified allegation on the other award.
    await call(ALICE, 'POST', '/issues', { orgId: 'org_a', awardId: aw2, source: 'complaint', type: 'governance', title: 'Unverified allegation' })

    // Closing with an open issue: closed with open matters.
    const closed = await call(ALICE, 'PUT', `/${aw}`, { close: true })
    assert.equal(closed.body.status, 'closed_with_open_matters')

    // The organisation sees everything; outsiders nothing.
    const own = (await call(ALICE, 'GET', '?orgId=org_a')).body
    assert.deepEqual([own.awards.length, own.measures.length, own.issues.length, own.trackRecord.verifiedIssues], [2, 1, 2, 1])
    assert.equal((await call(BOB, 'GET', '?orgId=org_a')).status, 403)

    // Funder one sees its own award's issues only; funder two sees its own award (with the allegation) but no track record.
    let f1 = (await call(FUNDER, 'GET', '/funder')).body.organisations
    assert.deepEqual(f1.map((o: any) => [o.name, o.ownAwardIssues.length, o.shared]), [['Riverbend', 1, null]])
    // Lifecycle stage and rating: this award was closed above, so it is post-award; no rating yet.
    assert.deepEqual([f1[0].awards[0].stage, f1[0].awards[0].rating], ['post_award', null])
    const st = (id: string) => [{ id, text: id }, { id: `${id}b`, text: `${id}b` }]
    const dom = (id: string, critical = false) => ({ id, name: id, level1: 'x', critical, levels: { 2: st(`${id}.2`), 3: st(`${id}.3`), 4: st(`${id}.4`) } })
    blobStores().set('cca-private', new Map([['modules', { bytes: Buffer.from(JSON.stringify([{ id: 'pre_award', name: 'Pre-Award', audience: 'x', areas: [{ id: 'pa', name: 'Finance', domains: [dom('p1', true), dom('p2'), dom('p3')] }] }])) }]]))
    const seen = { met: true, evidence: 'seen' }
    await rows(`INSERT INTO cca_assessments(id,org_id,module,year,award_ref,status,responses,created_by,completed_at) VALUES('cca_pa','org_a','pre_award',2026,'${aw}','complete','${JSON.stringify({ 'p1.2': seen, 'p1.2b': seen, 'p1.3': seen, 'p1.3b': seen })}','${ALICE}',now())`)
    const rated = (await call(FUNDER, 'GET', '/funder')).body.organisations[0].awards.find((x: any) => x.id === aw)
    assert.deepEqual([rated.stage, rated.rating.module, rated.rating.level, rated.rating.percent, rated.rating.readiness], ['post_award', 'pre_award', 'Emerging', 42, 'Ready with conditions'])
    let f2 = (await call(OTHER, 'GET', '/funder')).body.organisations[0]
    assert.deepEqual([f2.ownAwardIssues.map((i: any) => i.title), f2.shared], [['Unverified allegation'], null])

    // Sharing: summary gives counts only; full gives verified issues only, never the allegation.
    assert.equal((await call(BOB, 'PUT', '/shares', { orgId: 'org_a', viewerEmail: OTHER, level: 'full' })).status, 403)
    assert.equal((await call(ALICE, 'PUT', '/shares', { orgId: 'org_a', viewerEmail: OTHER, level: 'summary' })).status, 200)
    f2 = (await call(OTHER, 'GET', '/funder')).body.organisations[0]
    assert.deepEqual([f2.shared.level, f2.shared.trackRecord.verifiedIssues, f2.shared.issues.length], ['summary', 1, 0])
    await call(ALICE, 'PUT', '/shares', { orgId: 'org_a', viewerEmail: OTHER, level: 'full' })
    f2 = (await call(OTHER, 'GET', '/funder')).body.organisations[0]
    assert.deepEqual(f2.shared.issues.map((i: any) => [i.title, i.orgResponse]), [['Advances not retired', 'Ageing report introduced; 9 advances retired.']])
    assert.equal((await call(ALICE, 'DELETE', '/shares', { orgId: 'org_a', viewerEmail: OTHER })).status, 200)
    assert.equal((await call(OTHER, 'GET', '/funder')).body.organisations[0].shared, null, 'sharing can be withdrawn')

    // Fix held, issue closed, measure lifted by the funder.
    await call(ALICE, 'PUT', `/issues/${iss}`, { status: 'closed', fixHeld: true })
    assert.equal((await call(FUNDER, 'PUT', `/measures/${m.body.id}`, { lift: true })).status, 200)
    f1 = (await call(FUNDER, 'GET', '/funder')).body.organisations[0]
    assert.deepEqual([f1.measures[0].status, f1.ownAwardIssues[0].status], ['lifted', 'closed'])

    const audit = await rows(`SELECT action FROM audit_logs WHERE org_id='org_a' ORDER BY id`)
    assert.ok(audit.some((x) => /Shared issue track record \(summary\)/.test(x.action)) && audit.some((x) => /Closed award \(closed_with_open_matters\)/.test(x.action)))
  })
})
