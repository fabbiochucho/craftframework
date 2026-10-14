// Self-check — run directly with `node src/lib/regulatory-sources.test.ts`.
import assert from 'node:assert/strict'
import { regulatorySources, sourceByKey, sourceStatus } from './regulatory-sources.ts'

const all = regulatorySources()
assert.equal(all.filter((s) => s.kind === 'country_profile').length, 54)
assert.equal(all.filter((s) => s.kind === 'jurisdiction_pack').length, 54)
assert.equal(new Set(all.map((s) => s.key)).size, all.length)

const ng = sourceByKey('jur:NG')!
assert.equal(sourceStatus(ng, null, '2026-10-14').status, 'verified')
assert.equal(sourceStatus(ng, null, '2027-10-11').status, 'due', 'a year after the catalogue check')
const bw = sourceByKey('afr:BW')!
assert.equal(sourceStatus(bw, null, '2026-10-14').status, 'unverified', 'unconfirmed fields need a workspace check')
assert.deepEqual(sourceStatus(bw, { outcome: 'confirmed', checkedAt: '2026-10-14T09:00:00Z' }, '2026-10-15'), { status: 'verified', lastVerified: '2026-10-14', dueOn: '2027-10-14' })
assert.equal(sourceStatus(bw, { outcome: 'changed', checkedAt: '2026-10-14T09:00:00Z' }, '2026-10-15').status, 'changed')
assert.equal(sourceStatus(bw, { outcome: 'unreachable', checkedAt: '2026-10-14T09:00:00Z' }, '2026-10-15').status, 'unverified')
console.log('regulatory-sources.test.ts: all assertions passed')
