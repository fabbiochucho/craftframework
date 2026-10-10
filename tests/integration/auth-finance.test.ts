import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { installFetchMock, rows, truncateAll } from './harness.ts'

const auth = await import(new URL('../../netlify/lib/auth.ts', import.meta.url).href)
const finance = (await import(new URL('../../netlify/functions/financial-triangulation.mts', import.meta.url).href)).default
const issueGrant = (await import(new URL('../../netlify/functions/issue-access-grant.mts', import.meta.url).href)).default
const compliance = (await import(new URL('../../netlify/functions/compliance.mts', import.meta.url).href)).default

describe('legacy route authorization regressions', () => {
  beforeEach(async () => { await truncateAll() })

  it('permits read grants at GET handlers without permitting writes', async () => {
    ;(globalThis as any).__craftTestIdentity = { email: 'reader@example.com' }
    await rows("INSERT INTO access_grants(id,org_id,grantee,level,status) VALUES('read','external','reader@example.com','read','active')")
    for (const endpoint of ['responses', 'capacity-actions', 'section11', 'compliance', 'audit', 'access-grants']) {
      const handler = (await import(new URL(`../../netlify/functions/${endpoint}.mts`, import.meta.url).href)).default
      assert.equal((await handler(new Request(`http://localhost/api/${endpoint}?orgId=external`))).status, 200, endpoint)
    }
    assert.equal((await compliance(new Request('http://localhost/api/compliance', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orgId: 'external', name: 'Denied', nextDueDate: '2026-12-01' }),
    }))).status, 403)
  })

  it('rejects a writable tenant claiming another tenant obligation ID', async () => {
    ;(globalThis as any).__craftTestIdentity = { email: 'writer@example.com' }
    await rows("INSERT INTO users(id,email,org_id,role) VALUES('writer','writer@example.com','own','assessor')")
    await rows("INSERT INTO compliance_items(id,org_id,name,next_due_date) VALUES('victim','external','Existing','2026-12-01')")
    const response = await compliance(new Request('http://localhost/api/compliance', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'victim', orgId: 'own', name: 'Attack', nextDueDate: '2027-01-01', status: 'completed' }),
    }))
    assert.equal(response.status, 403)
    const [item] = await rows("SELECT next_due_date::text AS due FROM compliance_items WHERE id='victim'")
    assert.equal(item.due, '2026-12-01')
  })
})

describe('legacy API authorization and finance workflow', () => {
  beforeEach(async () => { await truncateAll() })

  it('enforces read-only and expiry for active legacy grants at the origin', async () => {
    const caller = { email: 'reviewer@example.com', name: 'Reviewer', orgId: 'own', role: 'assessor' }
    await rows("INSERT INTO access_grants(id,org_id,grantee,level,status) VALUES('read-grant','external',$1,'read','active')", [caller.email])
    assert.equal(await auth.canAccessOrg(caller, 'external', 'read'), true)
    await rows("INSERT INTO organizations(id,name,reviewer) VALUES('external','External',$1)", [caller.email])
    assert.equal(await auth.canAccessOrg(caller, 'external'), false)
    await rows("UPDATE access_grants SET level='write', expires_at=now()-interval '1 second'")
    assert.equal(await auth.canAccessOrg(caller, 'external', 'read'), false)
    await rows("UPDATE access_grants SET expires_at=now()+interval '1 hour'")
    assert.equal(await auth.canAccessOrg(caller, 'external'), true)
    await rows("UPDATE access_grants SET role='cbn_examiner'")
    assert.equal(await auth.canAccessOrg(caller, 'external'), false)
    assert.equal(await auth.canAccessOrg(caller, 'external', 'read'), true)
  })

  it('checks verified Identity specialized expiry at the API boundary', async () => {
    ;(globalThis as any).__craftTestIdentity = { email: 'reviewer@example.com', appMetadata: { role: 'cbn_examiner', access_expires_at: Math.floor(Date.now() / 1000) - 1 } }
    assert.equal(await auth.resolveCaller(), null)
    ;(globalThis as any).__craftTestIdentity.appMetadata.access_expires_at = Math.floor(Date.now() / 1000) + 3600
    const caller = await auth.resolveCaller()
    assert.equal(caller.readOnly, true)
    assert.equal(await auth.canAccessOrg(caller, caller.orgId), false)
  })

  it('derives workflow roles, lock identity and append-only history from the server, preserving partial fields', async () => {
    for (const role of ['org_finance_officer', 'org_grant_manager', 'independent_assessor']) {
      await rows("INSERT INTO users(id,email,org_id,role) VALUES($1,$2,'finance_org',$1)", [role, `${role}@example.com`])
    }
    const save = async (role: string, body: Record<string, unknown>) => {
      ;(globalThis as any).__craftTestIdentity = { email: `${role}@example.com` }
      return finance(new Request('http://localhost/api/financial-triangulation', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId: 'finance_org', contextKey: 'period_1', ...body }),
      }))
    }
    assert.equal((await save('org_finance_officer', { expenditures: 100, financeOfficerNotes: 'Prepared', history: ['forged'], id: 'forged-id' })).status, 201)
    assert.equal((await save('org_grant_manager', { status: 'pending_assessor' })).status, 403)
    assert.equal((await save('org_finance_officer', { status: 'pending_review' })).status, 201)
    assert.equal((await save('org_grant_manager', { expenditures: 200 })).status, 403)
    assert.equal((await save('org_grant_manager', { grantManagerCommentary: 'Approved', status: 'pending_assessor' })).status, 201)
    const locked = await save('independent_assessor', { status: 'locked', lockedBy: 'forged', lockedAt: 'yesterday', history: [], assessorNotes: 'Reviewed' })
    assert.equal(locked.status, 201)
    const value = await locked.json()
    assert.equal(value.lockedBy, 'independent_assessor@example.com')
    assert.notEqual(value.lockedAt, 'yesterday')
    assert.notEqual(value.id, 'forged-id')
    assert.equal(value.expenditures, 100)
    assert.equal(value.financeOfficerNotes, 'Prepared')
    assert.equal(value.grantManagerCommentary, 'Approved')
    assert.equal(value.history.length, 4)
    assert.ok(!value.history.includes('forged'))
    assert.equal((await save('org_finance_officer', { status: 'draft' })).status, 403)
    assert.equal((await save('independent_assessor', { assessorNotes: 'Changed' })).status, 403)
  })

  it('does not report successful Identity stamping when the provider rejects metadata updates', async () => {
    await rows("INSERT INTO users(id,email,org_id,role) VALUES('issuer','issuer@example.com','grant_org','admin')")
    ;(globalThis as any).__craftTestIdentity = { email: 'issuer@example.com' }
    process.env.NETLIFY_IDENTITY_ADMIN_TOKEN = 'test-provider'
    process.env.NETLIFY_IDENTITY_URL = 'https://identity.example'
    let calls = 0
    const mock = installFetchMock(() => {
      calls++
      return calls === 1
        ? Response.json({ users: [{ id: 'wrong', email: 'someone@example.com' }, { id: 'correct', email: 'recipient@example.com', app_metadata: {} }] })
        : Response.json({ error: 'denied' }, { status: 403 })
    })
    try {
      const response = await issueGrant(new Request('http://localhost/api/issue-access-grant', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId: 'grant_org', grantee: 'recipient@example.com', role: 'cbn_examiner' }),
      }))
      assert.equal(response.status, 201)
      const result = await response.json()
      assert.equal(result.identityStamped, false)
      assert.equal(result.grant.level, 'read')
      assert.ok(result.grant.expiresAt)
      assert.equal(mock.calls[1].url, 'https://identity.example/admin/users/correct')
    } finally {
      mock.restore()
      delete process.env.NETLIFY_IDENTITY_ADMIN_TOKEN
      delete process.env.NETLIFY_IDENTITY_URL
    }
  })
})
