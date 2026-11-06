// Self-check — run directly with `node src/lib/cca/networkFeed.test.ts`.
import assert from 'node:assert/strict'
import { dashboard, type CcaModule, type Domain } from './engine.ts'
import { latestPerOrg, networkCcaFeed } from './networkFeed.ts'
import type { NetworkMember, NetworkNode } from '../networks.ts'

const dom = (id: string): Domain => ({ id, name: id, level1: 'x', levels: { 2: [{ id: `${id}.2`, text: 'a' }], 3: [{ id: `${id}.3`, text: 'b' }], 4: [{ id: `${id}.4`, text: 'c' }] } })
const m: CcaModule = { id: 'community', name: 'Community', audience: 'x', areas: [{ id: 'A', name: 'Area A', domains: [dom('a1')] }] }
const ok = { met: true, evidence: 'seen' }
const at = (level: 1 | 2 | 3 | 4) => dashboard(m, Object.fromEntries(['a1.2', 'a1.3', 'a1.4'].slice(0, level - 1).map((k) => [k, ok])))

const node = (id: string, parentId: string | null, name: string): NetworkNode => ({ id, networkId: 'n', parentId, level: parentId ? 'subnational' : 'national', name, geoCode: '' })
const nodes = [node('nat', null, 'National'), node('kano', 'nat', 'Kano'), node('lagos', 'nat', 'Lagos')]
const mem = (orgId: string, nodeId: string, sharing: 'aggregate' | 'full' = 'aggregate', status: NetworkMember['status'] = 'accepted'): NetworkMember => ({ id: `${orgId}-${nodeId}`, nodeId, orgId, status, sharing })
// Kano: 5 members with results (shown). Lagos: 2 members, one named, one not (hidden). One invited member never counts.
const members = [...['k1', 'k2', 'k3', 'k4', 'k5'].map((o) => mem(o, 'kano')), mem('l1', 'lagos', 'full'), mem('l2', 'lagos'), mem('x9', 'kano', 'full', 'invited')]
const results = [...['k1', 'k2', 'k3', 'k4', 'k5'].map((o, i) => ({ orgId: o, year: 2026, dashboard: at(i < 3 ? 2 : 4) })), { orgId: 'l1', year: 2026, dashboard: at(3) }, { orgId: 'l2', year: 2026, dashboard: at(1) }, { orgId: 'x9', year: 2026, dashboard: at(4) }]

const f = networkCcaFeed(nodes, members, results, 'nat', (id) => id.toUpperCase())!
assert.deepEqual([f.overall.members, f.overall.withResults, f.overall.shown], [7, 7, true])
const [kano, lagos] = f.children
assert.deepEqual([kano.name, kano.shown, kano.areas![0].percent], ['Kano', true, 70], 'Kano: (2+2+2+4+4)/5 = 2.8 = 70%')
assert.deepEqual([lagos.name, lagos.withResults, lagos.shown, lagos.areas, lagos.level], ['Lagos', 2, false, null, null], 'two members, not all named: hidden')
assert.deepEqual(f.named.map((x) => [x.name, x.level]), [['L1', 'Expanding']], 'only members who chose named results; invited never')

// A small group where everyone chose named results may be shown.
const allNamed = networkCcaFeed(nodes, [mem('l1', 'lagos', 'full')], results, 'lagos', (id) => id)!
assert.equal(allNamed.overall.shown, true)
assert.equal(networkCcaFeed(nodes, members, results, 'nope', String), null)

// Latest completed whole-body assessment per organisation.
const row = (orgId: string, year: number, extra = {}) => ({ orgId, module: 'community', year, awardRef: '', region: '', district: '', status: 'complete', completedAt: `${year}-06-01`, ...extra })
assert.deepEqual(latestPerOrg([row('a', 2025), row('a', 2026), row('a', 2027, { status: 'draft' }), row('b', 2026, { region: 'Kano' }), row('c', 2026, { awardRef: 'aw' }), row('d', 2026, { module: 'state' })], 'community').map((r) => [r.orgId, r.year]), [['a', 2026]])
console.log('cca/networkFeed.test.ts: all assertions passed')
