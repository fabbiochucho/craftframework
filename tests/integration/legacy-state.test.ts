import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const handler = (await import(new URL('../../netlify/functions/legacy-state.mts', import.meta.url).href)).default
const archive = (await import(new URL('../../netlify/functions/assessment-archive.mts', import.meta.url).href)).default

async function call(email: string | null, method: string, orgId: string, value?: unknown, origin?: string) {
  ;(globalThis as any).__craftTestIdentity = email ? { email } : null
  return handler(new Request(`http://localhost/api/legacy-state?orgId=${orgId}&key=roca:answers`, {
    method, headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
    body: method === 'PUT' ? JSON.stringify({ orgId, key: 'roca:answers', value }) : undefined,
  }))
}

describe('legacy tenant assessment state', () => {
  beforeEach(async () => {
    await truncateAll()
    await rows("INSERT INTO users(id,email,org_id,role) VALUES('owner','owner@example.com','tenant','assessor'),('other','other@example.com','other','assessor')")
  })
  it('persists encrypted state and reads only authorized tenants', async () => {
    assert.equal((await call(null, 'GET', 'tenant')).status, 401)
    assert.equal((await call('owner@example.com', 'PUT', 'tenant', { records: 3 })).status, 200)
    const [stored] = await rows('SELECT value FROM legacy_workspace_state')
    assert.ok(stored.value.startsWith('enc:'))
    assert.equal((await call('other@example.com', 'GET', 'tenant')).status, 403)
    assert.equal((await call('other@example.com', 'PUT', 'tenant', {})).status, 403)
    assert.deepEqual(await (await call('owner@example.com', 'GET', 'tenant')).json(), { value: { records: 3 } })
  })
  it('enforces read-only grants and rejects cross-origin writes', async () => {
    await rows("INSERT INTO access_grants(id,org_id,grantee,level,status) VALUES('grant','tenant','other@example.com','read','active')")
    assert.equal((await call('other@example.com', 'GET', 'tenant')).status, 200)
    assert.equal((await call('other@example.com', 'PUT', 'tenant', {})).status, 403)
    assert.equal((await call('owner@example.com', 'PUT', 'tenant', {}, 'https://untrusted.example')).status, 403)
  })
  it('rejects revoked and expired grants without changing persisted state', async () => {
    await call('owner@example.com', 'PUT', 'tenant', { records: 2 })
    await rows("INSERT INTO access_grants(id,org_id,grantee,level,status,expires_at) VALUES('grant','tenant','other@example.com','write','active',now()-interval '1 second')")
    assert.equal((await call('other@example.com', 'GET', 'tenant')).status, 403)
    assert.equal((await call('other@example.com', 'PUT', 'tenant', { records: 4 })).status, 403)
    await rows("UPDATE access_grants SET expires_at=now()+interval '1 hour',status='revoked'")
    assert.equal((await call('other@example.com', 'GET', 'tenant')).status, 403)
    assert.deepEqual(await (await call('owner@example.com', 'GET', 'tenant')).json(), { value: { records: 2 } })
  })

  it('keeps each encrypted saved revision across sign-ins and does not archive failed writes', async () => {
    const first = await (await call('owner@example.com', 'PUT', 'tenant', { records: 1 })).json()
    const second = await (await call('owner@example.com', 'PUT', 'tenant', { records: 2 })).json()
    assert.ok(first.savedAt && second.savedAt)
    assert.equal((await call('other@example.com', 'PUT', 'tenant', { records: 9 })).status, 403)
    const stored = await rows('SELECT * FROM assessment_revisions ORDER BY id')
    assert.equal(stored.length, 2)
    assert.ok(stored.every((r: any) => r.snapshot.startsWith('enc:') && r.actor === 'owner@example.com' && r.period === null))
    ;(globalThis as any).__craftTestIdentity = null
    assert.equal((await archive(new Request('http://localhost/api/assessment-archive'))).status, 401)
    ;(globalThis as any).__craftTestIdentity = { email: 'owner@example.com' }
    const response = await archive(new Request('http://localhost/api/assessment-archive?source=legacy'))
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    const history = await response.json()
    assert.deepEqual(history.revisions.map((r: any) => r.snapshot.records), [2, 1])
    assert.equal(history.revisions[0].savedAt, second.savedAt)
    ;(globalThis as any).__craftTestIdentity = { email: 'other@example.com' }
    assert.deepEqual((await (await archive(new Request('http://localhost/api/assessment-archive'))).json()).revisions, [])
  })

  it('rechecks current access before disclosing an earlier revision', async () => {
    await rows("INSERT INTO access_grants(id,org_id,grantee,level,status) VALUES('grant','tenant','other@example.com','write','active')")
    await call('other@example.com', 'PUT', 'tenant', { records: 4 })
    assert.equal((await (await archive(new Request('http://localhost/api/assessment-archive'))).json()).revisions.length, 1)
    await rows("UPDATE access_grants SET status='revoked'")
    assert.deepEqual((await (await archive(new Request('http://localhost/api/assessment-archive'))).json()).revisions, [])
    assert.equal((await rows('SELECT 1 FROM assessment_revisions')).length, 1, 'revocation restricts access without destroying the audit history')
  })

  it('rolls back the assessment write if its revision cannot be recorded', async () => {
    await call('owner@example.com', 'PUT', 'tenant', { records: 1 })
    await rows("ALTER TABLE assessment_revisions ADD CONSTRAINT archive_failure_test CHECK (record_key <> 'roca:answers') NOT VALID")
    try {
      assert.equal((await call('owner@example.com', 'PUT', 'tenant', { records: 2 })).status, 500)
      assert.deepEqual(await (await call('owner@example.com', 'GET', 'tenant')).json(), { value: { records: 1 } })
      assert.equal((await rows('SELECT 1 FROM assessment_revisions')).length, 1)
    } finally {
      await rows('ALTER TABLE assessment_revisions DROP CONSTRAINT archive_failure_test')
    }
  })

  it('does not bypass withdrawn financial sharing when the author changes organisation', async () => {
    ;(globalThis as any).__craftTestIdentity = { email: 'owner@example.com' }
    const save = await handler(new Request('http://localhost/api/legacy-state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orgId: 'tenant', key: 'fair:scenarios', value: [{ name: 'Private financial scenario' }] }) }))
    assert.equal(save.status, 200)
    await rows("UPDATE users SET org_id='other' WHERE email='owner@example.com'")
    await rows("INSERT INTO access_grants(id,org_id,grantee,level,status) VALUES('financial','tenant','owner@example.com','read','active')")
    assert.deepEqual((await (await archive(new Request('http://localhost/api/assessment-archive?source=legacy'))).json()).revisions, [])
  })
})
