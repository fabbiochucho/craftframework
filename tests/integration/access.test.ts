// Authentication, tenant isolation (404-not-403, cross-org probing) and the
// per-route role matrix of the workspace API, against a real Postgres.
import assert from 'node:assert/strict'
import { before, beforeEach, describe, it } from 'node:test'
import {
  ADMIN, ASSESSOR, OUTSIDER, OWNER, VIEWER, as, createAssessment, createCap, createOrg, expectStatus, rows, truncateAll, uploadEvidence,
} from './harness.ts'

const ROLE_USERS = { viewer: VIEWER, assessor: ASSESSOR, admin: ADMIN, owner: OWNER } as const
const RANK = { viewer: 1, assessor: 2, admin: 3, owner: 4 } as const

describe('authentication', () => {
  beforeEach(truncateAll)

  it('rejects unauthenticated requests on every non-public route', async () => {
    const anon = as(null)
    for (const [method, p] of [
      ['GET', '/orgs'], ['POST', '/orgs'], ['GET', '/orgs/1/members'], ['GET', '/workspaces/1/cap'], ['POST', '/workspaces/1/cap'],
      ['GET', '/workspaces/1/evidence'], ['GET', '/workspaces/1/reports'], ['GET', '/workspaces/1/audit-log'],
      ['GET', '/privacy/export'], ['POST', '/privacy/erasure-requests'], ['GET', '/support-bot/issues'],
    ] as const) {
      const res = method === 'GET' ? await anon.get(p) : await anon.post(p, {})
      assert.equal(res.status, 401, `${method} ${p}`)
    }
  })

  it('still serves the public support-bot submit route without a session', async () => {
    const res = expectStatus(await as(null).post('/support-bot/submit-issue', { description: 'How do I add a workspace?', publicIssueDisclosure: true }), 201)
    assert.equal(res.body.classification, 'question')
    assert.equal((await rows('SELECT category FROM support_issues'))[0].category, 'question')
  })

  it('refuses consumer-mail users creating organizations', async () => {
    assert.equal((await as('someone@gmail.com').post('/orgs', { name: 'Nope' })).status, 403)
  })
})

describe('tenant isolation', () => {
  beforeEach(truncateAll)

  it('answers 404 (not 403) for non-members and leaks nothing about other orgs', async () => {
    const { orgId, wsId } = await createOrg()
    const missing = await as(OUTSIDER).get('/workspaces/999999/cap')
    for (const p of [`/orgs/${orgId}/members`, `/orgs/${orgId}/workspaces`, `/workspaces/${wsId}/cap`, `/workspaces/${wsId}/evidence`,
      `/workspaces/${wsId}/assessments`, `/workspaces/${wsId}/reports`, `/workspaces/${wsId}/audit-log`]) {
      const res = await as(OUTSIDER).get(p)
      assert.equal(res.status, 404, p)
      assert.deepEqual(res.body, { error: 'Not found' }, p)
    }
    // Same response as an id that does not exist at all, so existence cannot be probed.
    assert.equal(missing.status, 404)
    assert.deepEqual(missing.body, { error: 'Not found' })
    assert.equal((await as(OUTSIDER).post(`/orgs/${orgId}/members`, { email: OUTSIDER, role: 'owner' })).status, 404)
    assert.equal((await as(OUTSIDER).put(`/orgs/${orgId}`, { name: 'Hijacked' })).status, 404)
    assert.equal((await as(OUTSIDER).post(`/workspaces/${wsId}/cap`, { findingDescription: 'x' })).status, 404)
    assert.deepEqual((await as(OUTSIDER).get('/orgs')).body, [])
    assert.equal((await rows('SELECT name FROM ws_organizations'))[0].name, 'Acme Org')
  })

  it('returns 404 for another org\'s workspace, assessment, CAP, evidence and report ids', async () => {
    const a = await createOrg('Org A')
    const bOwner = 'owner@beta.example'
    const b = await createOrg('Org B', bOwner, {})
    const assessmentId = await createAssessment(a.wsId)
    const capId = await createCap(a.wsId)
    const evidenceId = await uploadEvidence(a.wsId)
    const reportId = expectStatus(await as(ASSESSOR).post(`/workspaces/${a.wsId}/reports/cap-summary`, {}), 201).body.id
    const beta = as(bOwner)
    const probes: [string, string][] = [
      ['GET', `/workspaces/${a.wsId}/assessments/${assessmentId}`],
      ['GET', `/workspaces/${a.wsId}/cap/${capId}`],
      ['GET', `/workspaces/${a.wsId}/evidence/${evidenceId}`],
      ['GET', `/workspaces/${a.wsId}/evidence/${evidenceId}/download`],
      ['GET', `/workspaces/${a.wsId}/reports/${reportId}`],
      ['GET', `/workspaces/${a.wsId}/reports/${reportId}/pdf`],
      ['GET', `/workspaces/${a.wsId}/reports/${reportId}/versions`],
      ['GET', `/orgs/${a.orgId}/members`],
      // Own workspace + the other org's resource id: loaders are scoped by org/workspace.
      ['GET', `/workspaces/${b.wsId}/assessments/${assessmentId}`],
      ['GET', `/workspaces/${b.wsId}/cap/${capId}`],
      ['GET', `/workspaces/${b.wsId}/evidence/${evidenceId}`],
      ['GET', `/workspaces/${b.wsId}/evidence/${evidenceId}/download`],
      ['GET', `/workspaces/${b.wsId}/reports/${reportId}`],
      ['GET', `/workspaces/${b.wsId}/reports/${reportId}/pdf`],
    ]
    for (const [, p] of probes) {
      const res = await beta.get(p)
      assert.equal(res.status, 404, p)
      assert.deepEqual(res.body, { error: 'Not found' }, `${p} leaked: ${res.text}`)
    }
    // Writes via own workspace referencing foreign ids are rejected without side effects.
    for (const [m, p, body] of [
      ['PUT', `/workspaces/${b.wsId}/cap/${capId}`, { severity: 'low' }],
      ['POST', `/workspaces/${b.wsId}/cap/${capId}/close`, {}],
      ['POST', `/workspaces/${b.wsId}/evidence/${evidenceId}/approve`, {}],
      ['DELETE', `/workspaces/${b.wsId}/evidence/${evidenceId}`, undefined],
      ['POST', `/workspaces/${b.wsId}/assessments/${assessmentId}/submit`, {}],
    ] as const) {
      const res = m === 'PUT' ? await beta.put(p, body) : m === 'DELETE' ? await beta.del(p) : await beta.post(p, body)
      assert.equal(res.status, 404, `${m} ${p}`)
    }
    // A CAP cannot be created from, or linked to, a finding/evidence/requirement of another workspace.
    assert.equal((await beta.post(`/workspaces/${b.wsId}/cap`, { sourceType: 'governance_finding', sourceId: 1 })).status, 400)
    assert.equal((await beta.post(`/workspaces/${b.wsId}/cap`, { sourceType: 'esg_requirement', sourceId: 1 })).status, 404)
    const ownCap = await createCap(b.wsId, bOwner)
    assert.equal((await beta.put(`/workspaces/${b.wsId}/evidence/${evidenceId}`, { link: { targetType: 'cap', targetId: ownCap } })).status, 404)
    const bAction = expectStatus(await beta.post(`/workspaces/${b.wsId}/cap/${ownCap}/actions`, { actionDescription: 'Do it' }), 201).body.id
    assert.equal((await beta.put(`/workspaces/${b.wsId}/cap/${ownCap}/actions/${bAction}`, { evidenceId })).status, 404)
    assert.equal((await rows("SELECT status FROM cap_records WHERE id = $1", [capId]))[0].status, 'open')
    assert.equal((await rows('SELECT archived_at FROM evidence_registry'))[0].archived_at, null)
    assert.equal((await rows('SELECT count(*)::int AS n FROM evidence_links'))[0].n, 0)
  })
})

describe('role boundaries', () => {
  let wsId = 0, orgId = 0, capId = 0, assessmentId = 0, evidenceId = 0
  before(truncateAll)
  beforeEach(async () => {
    await truncateAll()
    ;({ orgId, wsId } = await createOrg())
    capId = await createCap(wsId)
    assessmentId = await createAssessment(wsId)
    evidenceId = await uploadEvidence(wsId)
  })

  // [method, path builder, minimum role, body]. Bodies are deliberately invalid
  // or no-ops: the matrix only asserts WHO is allowed through the role gate (a
  // 400/409 proves the gate was passed; 403 proves it blocked).
  const routes: [string, () => string, keyof typeof RANK, unknown?][] = [
    ['GET', () => `/orgs/${orgId}/members`, 'viewer'],
    ['GET', () => `/orgs/${orgId}/workspaces`, 'viewer'],
    ['GET', () => `/workspaces/${wsId}/assessments`, 'viewer'],
    ['GET', () => `/workspaces/${wsId}/cap`, 'viewer'],
    ['GET', () => `/workspaces/${wsId}/evidence`, 'viewer'],
    ['GET', () => `/workspaces/${wsId}/reports`, 'viewer'],
    ['POST', () => `/workspaces/${wsId}/assessments`, 'assessor', { assessmentType: 'bogus' }],
    ['POST', () => `/workspaces/${wsId}/cap`, 'assessor', {}],
    ['PUT', () => `/workspaces/${wsId}/cap/${capId}`, 'assessor', {}],
    ['POST', () => `/workspaces/${wsId}/cap/${capId}/actions`, 'assessor', {}],
    ['PUT', () => `/workspaces/${wsId}/evidence/${evidenceId}`, 'assessor', {}],
    ['POST', () => `/workspaces/${wsId}/assessments/${assessmentId}/findings`, 'assessor', {}],
    ['PUT', () => `/workspaces/${wsId}/assessments/${assessmentId}/scores/Pillar/Domain`, 'assessor', { score: 99 }],
    ['POST', () => `/workspaces/${wsId}/reports/cap-summary`, 'assessor', {}],
    ['POST', () => `/orgs/${orgId}/workspaces`, 'admin', {}],
    ['PUT', () => `/orgs/${orgId}`, 'admin', {}],
    ['POST', () => `/orgs/${orgId}/members`, 'admin', {}],
    ['POST', () => `/workspaces/${wsId}/assessments/${assessmentId}/approve`, 'admin', {}],
    ['POST', () => `/workspaces/${wsId}/assessments/${assessmentId}/reject`, 'admin', {}],
    ['POST', () => `/workspaces/${wsId}/cap/${capId}/close`, 'admin', {}],
    ['POST', () => `/workspaces/${wsId}/evidence/${evidenceId}/approve`, 'admin', { status: 'bogus' }],
    ['GET', () => `/workspaces/${wsId}/reports/schedules`, 'admin'],
    ['POST', () => `/workspaces/${wsId}/reports/schedules`, 'admin', {}],
    ['POST', () => `/workspaces/${wsId}/reports/audit-trail`, 'admin', {}],
    ['GET', () => `/workspaces/${wsId}/audit-log`, 'admin'],
    ['POST', () => `/workspaces/${wsId}/audit-log/export`, 'admin', {}],
  ]

  it('enforces the minimum role on every route (403 below, allowed at and above)', async () => {
    for (const [method, path, min, body] of routes) {
      for (const [roleName, email] of Object.entries(ROLE_USERS) as [keyof typeof RANK, string][]) {
        const u = as(email)
        const p = path()
        const res = method === 'GET' ? await u.get(p) : method === 'PUT' ? await u.put(p, body) : await u.post(p, body)
        const label = `${roleName} ${method} ${p}`
        if (RANK[roleName] < RANK[min]) assert.equal(res.status, 403, label)
        else assert.ok(![401, 403, 404].includes(res.status), `${label} -> ${res.status} ${res.text.slice(0, 200)}`)
      }
    }
  })

  it('restricts evidence deletion and report schedule management to admins', async () => {
    assert.equal((await as(ASSESSOR).del(`/workspaces/${wsId}/evidence/${evidenceId}`)).status, 403)
    assert.equal((await as(VIEWER).del(`/workspaces/${wsId}/evidence/${evidenceId}`)).status, 403)
    assert.equal((await as(ASSESSOR).del(`/workspaces/${wsId}/reports/schedules/1`)).status, 403)
    assert.equal((await as(ASSESSOR).post(`/workspaces/${wsId}/reports/schedules/1/pause`, { paused: true })).status, 403)
    expectStatus(await as(ADMIN).del(`/workspaces/${wsId}/evidence/${evidenceId}`), 200)
  })

  it('stops an admin promoting anyone (including themselves) to owner or changing owners', async () => {
    const admin = as(ADMIN)
    assert.equal((await admin.post(`/orgs/${orgId}/members`, { email: VIEWER, role: 'owner' })).status, 403)
    assert.equal((await admin.post(`/orgs/${orgId}/members`, { email: ADMIN, role: 'owner' })).status, 403)
    assert.equal((await admin.post(`/orgs/${orgId}/members`, { email: 'new@acme.example', role: 'owner' })).status, 403)
    assert.equal((await admin.post(`/orgs/${orgId}/members`, { email: OWNER, role: 'viewer' })).status, 403)
    const ownerMember = (await as(OWNER).get(`/orgs/${orgId}/members`)).body.find((m: any) => m.userId === OWNER)
    assert.equal((await admin.del(`/orgs/${orgId}/members/${ownerMember.id}`)).status, 403)
    assert.equal((await as(ASSESSOR).post(`/orgs/${orgId}/members`, { email: VIEWER, role: 'admin' })).status, 403)
    expectStatus(await admin.post(`/orgs/${orgId}/members`, { email: VIEWER, role: 'assessor' }), 200)
    const roles = Object.fromEntries((await as(OWNER).get(`/orgs/${orgId}/members`)).body.map((m: any) => [m.userId, m.role]))
    assert.deepEqual(roles, { [OWNER]: 'owner', [ADMIN]: 'admin', [ASSESSOR]: 'assessor', [VIEWER]: 'assessor' })
  })

  it('lets an owner promote to owner but never leaves the org without one', async () => {
    const owner = as(OWNER)
    assert.equal((await owner.post(`/orgs/${orgId}/members`, { email: OWNER, role: 'admin' })).status, 409)
    expectStatus(await owner.post(`/orgs/${orgId}/members`, { email: ADMIN, role: 'owner' }), 200)
    expectStatus(await as(ADMIN).post(`/orgs/${orgId}/members`, { email: OWNER, role: 'admin' }), 200)
    assert.equal((await rows("SELECT count(*)::int AS n FROM ws_org_members WHERE role = 'owner'"))[0].n, 1)
  })
})
