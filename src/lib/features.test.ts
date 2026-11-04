// Self-check — run directly with `node src/lib/features.test.ts`.
import assert from 'node:assert/strict'
import { decide, featureForPath, FEATURES, type Switch, type Who } from './features.ts'

const who: Who = { email: 'amina@riverbend.example', orgId: 'org_riverbend', archetype: 'Civil Society', country: 'Kenya', networkIds: ['net_a', 'net_b'] }
const sw = (scope: Switch['scope'], scopeId: string, enabled: boolean, extra: Partial<Switch> = {}): Switch =>
  ({ feature: 'networks', scope, scopeId, enabled, reason: `${scope} ${enabled ? 'on' : 'off'}`, expiresAt: null, ...extra })
const now = new Date('2026-11-04T12:00:00Z')

// No settings: on.
assert.deepEqual(decide('networks', who, [], now), { enabled: true, scope: 'default', scopeId: '', reason: '' })

// Off for everyone is a kill switch, even over a user being switched on.
assert.equal(decide('networks', who, [sw('global', '', false), sw('user', who.email, true)], now).enabled, false)

// Otherwise the most specific setting wins.
assert.equal(decide('networks', who, [sw('archetype', 'civil society', false), sw('org', 'org_riverbend', true)], now).scope, 'org')
assert.equal(decide('networks', who, [sw('country', 'KENYA', false)], now).enabled, false, 'case-insensitive match')
assert.equal(decide('networks', who, [sw('global', '', true), sw('country', 'Kenya', false)], now).enabled, false)
assert.equal(decide('networks', who, [sw('org', 'org_riverbend', false), sw('user', 'AMINA@riverbend.example', true)], now).enabled, true)

// Networks that disagree: off wins.
const both = decide('networks', who, [sw('network', 'net_a', true), sw('network', 'net_b', false)], now)
assert.deepEqual([both.enabled, both.scopeId], [false, 'net_b'])

// Settings for other people, other features, or that have expired don't count.
assert.equal(decide('networks', who, [sw('org', 'org_other', false), sw('network', 'net_z', false), { ...sw('global', '', false), feature: 'training' }], now).enabled, true)
assert.equal(decide('networks', who, [sw('global', '', false, { expiresAt: '2026-11-01T00:00:00Z' })], now).enabled, true)
assert.equal(decide('networks', who, [sw('global', '', false, { expiresAt: '2026-12-01T00:00:00Z' })], now).enabled, false)

// Paths map to their feature; the always-on parts map to none.
assert.equal(featureForPath('/networks/net_a/brief/r1', 'routes')?.key, 'networks')
assert.equal(featureForPath('/api/network-rounds/abc', 'api')?.key, 'networks')
assert.equal(featureForPath('/api/networks', 'api')?.key, 'networks')
assert.equal(featureForPath('/api/support-bot/chat', 'api')?.key, 'support-bot')
assert.equal(featureForPath('/api/trainingx', 'api'), undefined, 'prefix must end at a path boundary')
assert.equal(featureForPath('/assessment/abc', 'routes')?.key, 'frameworks')
for (const p of ['/dashboard', '/settings', '/admin', '/audit-log', '/help', '/validation/V123', '/privacy']) assert.equal(featureForPath(p, 'routes'), undefined, p)
for (const p of ['/api/public-validation/x', '/api/users', '/api/features', '/api/support-tickets', '/api/organizations']) assert.equal(featureForPath(p, 'api'), undefined, p)
assert.equal(new Set(FEATURES.map((f) => f.key)).size, FEATURES.length, 'unique keys')

console.log('features.test.ts: all assertions passed')
