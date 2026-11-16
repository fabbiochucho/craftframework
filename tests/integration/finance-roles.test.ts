// Finance Triangulation for a real organisation: its owner names a finance officer and a grant manager (two different
// people, added to their normal access); its independent assessor, through their grant, verifies and locks.
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const finance = (await import(new URL('../../netlify/functions/financial-triangulation.mts', import.meta.url).href)).default
const ORG = 'self_owner_x_example'
const OWNER = 'owner@x.example'
const OFFICER = 'officer@x.example'
const MANAGER = 'manager@x.example'
const ASSESSOR = 'assessor@y.example'
const ctx = 'giz|g1|r1|core|2026-q4'

async function call(email: string, method: string, body?: unknown, qs = '') {
  ;(globalThis as any).__craftTestIdentity = { email }
  const res: Response = await finance(new Request(`http://localhost/api/financial-triangulation${qs}`, {
    method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }))
  return { status: res.status, body: await res.json().catch(() => null) }
}
const name = (who: string, role: string, email: string) => call(who, 'PUT', { orgId: ORG, role, email })
const save = (who: string, body: object) => call(who, 'POST', { orgId: ORG, contextKey: ctx, ...body })

describe('finance roles', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows(`INSERT INTO organizations(id, name, email, created_by) VALUES($1, 'Owner Org', $2, $2)`, [ORG, OWNER])
    for (const e of [OFFICER, MANAGER]) await rows(`INSERT INTO users(id,email,org_id,role) VALUES($1,$1,$2,'assessor')`, [e, ORG])
    await rows(`INSERT INTO access_grants(id, org_id, grantee, role, status, level) VALUES('g1', $1, $2, 'independent_assessor', 'active', 'read')`, [ORG, ASSESSOR])
  })

  it('lets the owner name two different people, and runs the officer -> manager -> assessor workflow', async () => {
    assert.equal((await name(OFFICER, 'org_finance_officer', OFFICER)).status, 200, 'a team member with write access may name')
    assert.equal((await name(ASSESSOR, 'org_grant_manager', ASSESSOR)).status, 403, 'the assessor cannot name finance roles')
    assert.equal((await name(OWNER, 'org_grant_manager', OFFICER)).status, 400, 'officer and manager must differ')
    assert.equal((await name(OWNER, 'org_grant_manager', MANAGER)).status, 200)
    assert.deepEqual((await call(OWNER, 'GET', undefined, `?roles=1&orgId=${ORG}`)).body, { myRole: '', named: { org_finance_officer: OFFICER, org_grant_manager: MANAGER } })
    assert.equal((await call(ASSESSOR, 'GET', undefined, `?roles=1&orgId=${ORG}`)).body.myRole, 'independent_assessor')

    assert.equal((await save(OWNER, { openingBalance: 5 })).status, 403, 'no finance role, no figures')
    assert.equal((await save(MANAGER, { openingBalance: 5 })).status, 403, 'the officer creates the submission')
    assert.equal((await save(OFFICER, { openingBalance: 1000, incomeReceived: 500, expenditures: 300, actualBankBalance: 1200 })).status, 201)
    assert.equal((await save(OFFICER, { status: 'pending_review' })).status, 201)
    assert.equal((await save(MANAGER, { grantManagerCommentary: 'Checked', status: 'pending_assessor' })).status, 201)
    assert.equal((await save(ASSESSOR, { openingBalance: 9 })).status, 403, 'the assessor cannot change the figures')
    const locked = await save(ASSESSOR, { assessorNotes: 'Matches the bank statement', status: 'locked' })
    assert.equal(locked.status, 201)
    assert.equal(locked.body.lockedBy, ASSESSOR)
    assert.equal(locked.body.openingBalance, 1000)

    // Revoking the assessor's grant ends their part.
    await rows(`UPDATE access_grants SET status='revoked'`)
    assert.equal((await call(ASSESSOR, 'GET', undefined, `?roles=1&orgId=${ORG}`)).status, 403)
  })
})
