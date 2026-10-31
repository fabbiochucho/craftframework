import assert from 'node:assert/strict'
import { templateNodes } from './networkTemplates.ts'
import { canNest, validGeoCode } from './networks.ts'

const top = { level: 'national' as const, name: 'Kenya', geoCode: 'KE' }
for (const t of ['blank', 'africa-regions-countries', 'nigeria-zones-states', 'cohort'] as const) {
  const nodes = templateNodes(t, top)
  assert.equal(nodes[0].parent, null, `${t}: top first`)
  assert.equal(nodes.filter((n) => n.parent === null).length, 1, `${t}: one top level`)
  const keys = new Set<string>()
  for (const n of nodes) {
    assert.ok(!keys.has(n.key), `${t}: unique key ${n.key}`)
    keys.add(n.key)
    assert.ok(validGeoCode(n.level, n.geoCode), `${t}: geo code ${n.geoCode} fits ${n.level}`)
    if (n.parent) {
      const p = nodes.find((x) => x.key === n.parent)
      assert.ok(p && canNest(p.level, n.level), `${t}: ${n.name} nests under ${p?.name}`)
    }
  }
}
const africa = templateNodes('africa-regions-countries', top)
assert.equal(africa.filter((n) => n.level === 'subregional').length, 5)
assert.equal(africa.filter((n) => n.level === 'national').length, 54)
const ng = templateNodes('nigeria-zones-states', top)
assert.equal(ng.filter((n) => n.level === 'zonal').length, 6)
assert.equal(ng.filter((n) => n.level === 'subnational').length, 37, '36 states and the FCT')
assert.ok(ng.some((n) => n.geoCode === 'NG-LA' && n.parent === 'NG-SW'), 'Lagos is in the South West')
assert.deepEqual(templateNodes('blank', top).map((n) => n.name), ['Kenya'])
console.log('networkTemplates.test.ts ok')
