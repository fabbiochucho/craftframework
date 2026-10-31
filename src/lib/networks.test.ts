import assert from 'node:assert/strict'
import { adminScope, ancestry, canNest, distinctAcceptedOrgs, memberView, showable, subtree, validGeoCode, type NetworkAdmin, type NetworkMember, type NetworkNode } from './networks.ts'

const n = (id: string, parentId: string | null, level: NetworkNode['level']): NetworkNode => ({ id, networkId: 'net', parentId, level, name: id, geoCode: '' })
const NODES = [
  n('africa', null, 'continental'), n('ecowas', 'africa', 'subregional'), n('ng', 'ecowas', 'national'),
  n('lagos', 'ng', 'subnational'), n('kano', 'ng', 'subnational'), n('gh', 'ecowas', 'national'),
]

// Levels nest downwards only; skipping a level is fine
assert.ok(canNest('national', 'subnational'))
assert.ok(canNest('global', 'national'))
assert.ok(canNest('national', 'zonal') && canNest('zonal', 'subnational'), 'zones sit between national and state')
assert.ok(!canNest('subnational', 'national'))
assert.ok(!canNest('national', 'national'))

// Geography codes
assert.ok(validGeoCode('national', 'NG'))
assert.ok(!validGeoCode('national', 'NGA'))
assert.ok(validGeoCode('subnational', 'NG-LA'))
assert.ok(!validGeoCode('subnational', 'Lagos'))
assert.ok(validGeoCode('subregional', 'ECOWAS'))
assert.ok(validGeoCode('national', ''))

// Tree walking
assert.deepEqual([...subtree(NODES, 'ng')].sort(), ['kano', 'lagos', 'ng'])
assert.deepEqual(ancestry(NODES, 'lagos').map((x) => x.id), ['africa', 'ecowas', 'ng', 'lagos'])

// A coordinator added at Nigeria sees Nigeria and its states, not Ghana; email match ignores case
const ADMINS: NetworkAdmin[] = [{ nodeId: 'ng', email: 'coord@ng.example', role: 'coordinator' }, { nodeId: 'lagos', email: 'view@la.example', role: 'viewer' }]
assert.deepEqual([...adminScope(NODES, ADMINS, 'Coord@NG.example')].sort(), ['kano', 'lagos', 'ng'])
assert.deepEqual([...adminScope(NODES, ADMINS, 'view@la.example', 'coordinator')], [], 'a viewer is not a coordinator')

// Members: "totals only" members are never named, only counted
const m = (id: string, nodeId: string, orgId: string, status: NetworkMember['status'], sharing: NetworkMember['sharing']): NetworkMember => ({ id, nodeId, orgId, status, sharing })
const MEMBERS = [
  m('1', 'lagos', 'o1', 'accepted', 'full'), m('2', 'lagos', 'o2', 'accepted', 'aggregate'), m('3', 'kano', 'o3', 'invited', 'aggregate'),
  m('4', 'gh', 'o4', 'accepted', 'full'), m('5', 'ng', 'o1', 'accepted', 'full'), m('6', 'kano', 'o5', 'declined', 'aggregate'),
]
const view = memberView(MEMBERS, subtree(NODES, 'ng'), (id) => `Org ${id}`)
assert.deepEqual(view.counts, { invited: 1, accepted: 3, declined: 1 })
assert.deepEqual(view.named.map((x) => x.orgId).sort(), ['o1', 'o1'])
assert.equal(view.totalsOnly, 1)
assert.ok(!view.named.some((x) => x.orgId === 'o2' || x.orgId === 'o4'), 'aggregate members and out-of-scope members are never named')

// An organisation linked at two levels counts once
assert.deepEqual(distinctAcceptedOrgs(MEMBERS, subtree(NODES, 'ng')).sort(), ['o1', 'o2'])

// Small groups are suppressed
assert.ok(!showable(4))
assert.ok(showable(5))

console.log('networks.test.ts ok')

// Named-results groups can be shown at any size
import { everyoneNamed } from './networks.ts'
assert.ok(showable(2, true) && !showable(2, false) && !showable(0, true))
assert.ok(everyoneNamed(MEMBERS, subtree(NODES, 'gh')), 'Ghana: its one member chose named results')
assert.ok(!everyoneNamed(MEMBERS, subtree(NODES, 'lagos')), 'Lagos has a totals-only member')
assert.ok(!everyoneNamed(MEMBERS, new Set(['kano'])), 'no accepted members: nothing to show')
console.log('networks.test.ts small-groups ok')
