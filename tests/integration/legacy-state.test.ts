import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const handler = (await import(new URL('../../netlify/functions/legacy-state.mts', import.meta.url).href)).default

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
})
