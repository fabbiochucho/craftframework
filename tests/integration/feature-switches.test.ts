import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { rows, truncateAll } from './harness.ts'

const features = (await import(new URL('../../netlify/functions/features.mts', import.meta.url).href)).default
const networksApi = (await import(new URL('../../netlify/functions/networks.mts', import.meta.url).href)).default
const trainingApi = (await import(new URL('../../netlify/functions/training.mts', import.meta.url).href)).default
const { clearSwitchCache } = await import(new URL('../../netlify/lib/feature-gate.ts', import.meta.url).href)

const SUPER = 'fabbiochucho@gmail.com'
const AMINA = 'amina@riverbend.example' // Riverbend, Kenya, Civil Society, member of network net_a
const BEN = 'ben@lagos.example' // Lagos Trust, Nigeria, Private, no network

async function call(handler: (r: Request) => Promise<Response>, email: string | null, method: string, path: string, body?: unknown) {
  ;(globalThis as any).__craftTestIdentity = email ? { email, name: email } : null
  const res = await handler(new Request(`http://localhost${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
  const text = await res.text()
  let parsed: any = null
  try { parsed = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: parsed }
}
const set = (body: Record<string, unknown>) => call(features, SUPER, 'PUT', '/api/features/admin', body)
const mine = async (email: string | null) => (await call(features, email, 'GET', '/api/features')).body.features
const networksStatus = async (email: string) => (await call(networksApi, email, 'GET', '/api/networks')).status

describe('feature switches', () => {
  beforeEach(async () => {
    await truncateAll()
    clearSwitchCache()
    await rows(`INSERT INTO organizations(id,name,country,archetype) VALUES('org_riverbend','Riverbend','Kenya','Civil Society'),('org_lagos','Lagos Trust','Nigeria','Private')`)
    await rows(`INSERT INTO users(id,email,name,org_id,role) VALUES('u1','${AMINA}','Amina','org_riverbend','assessor'),('u2','${BEN}','Ben','org_lagos','assessor')`)
    await rows(`INSERT INTO networks(id,name,created_by) VALUES('net_a','Health CSO Network','${SUPER}')`)
    await rows(`INSERT INTO network_nodes(id,network_id,level,name) VALUES('node_a','net_a','national','Kenya chapter')`)
    await rows(`INSERT INTO network_members(id,node_id,org_id,status,invited_by) VALUES('m1','node_a','org_riverbend','accepted','${SUPER}')`)
  })

  it('only the Super Admin can change or inspect switches', async () => {
    assert.equal((await call(features, AMINA, 'PUT', '/api/features/admin', { feature: 'networks', scope: 'global', scopeId: '', enabled: false, reason: 'test' })).status, 403)
    assert.equal((await call(features, AMINA, 'GET', '/api/features/admin')).status, 403)
    assert.equal((await call(features, null, 'GET', '/api/features/admin')).status, 401)
    assert.equal((await set({ feature: 'nope', scope: 'global', scopeId: '', enabled: false, reason: 'test' })).status, 400, 'unknown feature')
    assert.equal((await set({ feature: 'networks', scope: 'org', scopeId: '', enabled: false, reason: 'test' })).status, 400, 'a scope needs a target')
    assert.equal((await set({ feature: 'networks', scope: 'global', scopeId: '', enabled: false, reason: '' })).status, 400, 'a reason is required')
  })

  it('a switched-off feature is refused by the server for the people it applies to, and nobody else', async () => {
    assert.equal(await networksStatus(AMINA), 200)
    assert.equal((await set({ feature: 'networks', scope: 'country', scopeId: 'kenya', enabled: false, reason: 'Pilot not yet open in Kenya' })).status, 200)
    const refused = await call(networksApi, AMINA, 'GET', '/api/networks')
    assert.equal(refused.status, 403)
    assert.equal(refused.body.error, 'feature_off')
    assert.match(refused.body.message, /Pilot not yet open in Kenya/)
    assert.equal(await networksStatus(BEN), 200)
    assert.equal((await mine(AMINA)).networks.enabled, false)
    assert.equal((await mine(BEN)).networks.enabled, true)
    assert.equal((await call(trainingApi, AMINA, 'GET', '/api/training')).status !== 403, true, 'other features unaffected')

    // A more specific setting wins: switched back on for Riverbend only.
    await set({ feature: 'networks', scope: 'org', scopeId: 'org_riverbend', enabled: true, reason: 'Riverbend pilots it' })
    assert.equal(await networksStatus(AMINA), 200)

    // ...but off for everyone is a kill switch, except for the Super Admin.
    await set({ feature: 'networks', scope: 'global', scopeId: '', enabled: false, reason: 'Maintenance' })
    assert.equal(await networksStatus(AMINA), 403)
    assert.equal(await networksStatus(BEN), 403)
    assert.equal(await networksStatus(SUPER), 200)
    assert.equal((await mine(null)).networks.enabled, false, 'signed-out visitors see a global switch-off')

    const audit = await rows(`SELECT action, target FROM audit_logs ORDER BY id`)
    assert.deepEqual(audit.map((a) => a.target), ['country:kenya', 'org:org_riverbend', 'global'])
    assert.match(audit[2].action, /Switched networks off \(Maintenance\)/)

    // Removing the switch restores access.
    await call(features, SUPER, 'DELETE', '/api/features/admin', { feature: 'networks', scope: 'global', scopeId: '' })
    assert.equal(await networksStatus(BEN), 200)
  })

  it('networks that disagree: off wins; "check as" shows which rule decided', async () => {
    await rows(`INSERT INTO networks(id,name,created_by) VALUES('net_b','Youth Network','${SUPER}')`)
    await rows(`INSERT INTO network_nodes(id,network_id,level,name) VALUES('node_b','net_b','national','Kenya youth')`)
    await rows(`INSERT INTO network_members(id,node_id,org_id,status,invited_by) VALUES('m2','node_b','org_riverbend','accepted','${SUPER}')`)
    await set({ feature: 'training', scope: 'network', scopeId: 'net_a', enabled: true, reason: 'Network A trains' })
    await set({ feature: 'training', scope: 'network', scopeId: 'net_b', enabled: false, reason: 'Network B not yet' })
    const check = (await call(features, SUPER, 'GET', `/api/features/check?email=${AMINA}`)).body
    assert.deepEqual(check.who.networkIds.sort(), ['net_a', 'net_b'])
    assert.equal(check.who.country, 'Kenya')
    assert.deepEqual([check.decisions.training.enabled, check.decisions.training.scope, check.decisions.training.scopeId], [false, 'network', 'net_b'])
    assert.equal(check.decisions.networks.scope, 'default')
    const admin = (await call(features, SUPER, 'GET', '/api/features/admin')).body
    assert.deepEqual(admin.options.country, ['Kenya', 'Nigeria'])
    assert.deepEqual(admin.options.network.map((n: any) => n.name), ['Health CSO Network', 'Youth Network'])
    assert.equal(admin.switches.length, 2)
  })
})
