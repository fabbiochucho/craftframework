import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'
import { ONBOARDING_DRAFT_KEY, restoreDraft } from '../../src/lib/onboardingDraft.ts'

const legacy = (await import(new URL('../../netlify/functions/legacy-state.mts', import.meta.url).href)).default
const progress = (await import(new URL('../../netlify/functions/onboarding-progress.mts', import.meta.url).href)).default

const draft = { orgName: 'Riverbend', archetype: 'Civil Society', country: 'KE', sector: 'Health', subsector: '', invites: [''], path: null, furthestStep: 1 }

async function state(email: string | null, method: 'GET' | 'PUT', orgId: string, value?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  return legacy(new Request(`http://localhost/api/legacy-state?orgId=${orgId}&key=${ONBOARDING_DRAFT_KEY}`, {
    method, headers: { 'content-type': 'application/json' },
    body: method === 'PUT' ? JSON.stringify({ orgId, key: ONBOARDING_DRAFT_KEY, value }) : undefined,
  })) as Promise<Response>
}
async function mark(email: string, body: unknown) {
  ;(globalThis as any).__craftTestIdentity = { email, name: email }
  return progress(new Request('http://localhost/api/onboarding-progress', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })) as Promise<Response>
}

describe('onboarding draft', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows("INSERT INTO users(id,email,org_id,role) VALUES('a','amina@riverbend.example','tenant-a','assessor'),('b','ben@other.example','tenant-b','assessor')")
  })
  it('is saved encrypted per tenant, restored for its owner and never visible to another user or tenant', async () => {
    assert.equal((await state(null, 'GET', 'tenant-a')).status, 401)
    assert.equal((await state('amina@riverbend.example', 'GET', 'tenant-a').then(r => r.json())).value ?? null, null)
    assert.equal((await state('amina@riverbend.example', 'PUT', 'tenant-a', draft)).status, 200)
    const [stored] = await rows('SELECT value FROM legacy_workspace_state')
    assert.ok(stored.value.startsWith('enc:'))
    assert.ok(!stored.value.includes('Riverbend'))
    // Restored after "coming back": same draft, same furthest step.
    const back = restoreDraft((await (await state('amina@riverbend.example', 'GET', 'tenant-a')).json()).value)
    assert.equal(back.furthestStep, 1)
    assert.equal(back.orgName, 'Riverbend')
    // Another user cannot read or overwrite it, and their own tenant has none.
    assert.equal((await state('ben@other.example', 'GET', 'tenant-a')).status, 403)
    assert.equal((await state('ben@other.example', 'PUT', 'tenant-a', { ...draft, orgName: 'Hijack' })).status, 403)
    assert.equal(((await (await state('ben@other.example', 'GET', 'tenant-b')).json()).value ?? null), null)
    assert.equal(restoreDraft((await (await state('amina@riverbend.example', 'GET', 'tenant-a')).json()).value).orgName, 'Riverbend')
  })
  it('does not complete onboarding until the final step is finished, and completion is recorded exactly once', async () => {
    const email = 'amina@riverbend.example'
    await state(email, 'PUT', 'tenant-a', draft) // saving a draft is not completion
    assert.equal((await mark(email, { step: 2 })).status, 200)
    let [p] = await rows('SELECT * FROM onboarding_progress WHERE email=$1', [email])
    assert.equal(p.step, 2)
    assert.equal(p.completed_at, null)
    assert.equal((await mark(email, { step: 3, completed: true })).status, 200)
    ;[p] = await rows('SELECT * FROM onboarding_progress WHERE email=$1', [email])
    assert.ok(p.completed_at)
    const first = new Date(p.completed_at).getTime()
    await new Promise(r => setTimeout(r, 20))
    assert.equal((await mark(email, { step: 3, completed: true })).status, 200)
    assert.equal((await mark(email, { step: 1 })).status, 200) // a later visit never un-completes or lowers it
    ;[p] = await rows('SELECT * FROM onboarding_progress WHERE email=$1', [email])
    assert.equal(new Date(p.completed_at).getTime(), first)
    assert.equal(p.step, 3)
    assert.equal((await rows('SELECT 1 FROM onboarding_progress')).length, 1)
  })
})
