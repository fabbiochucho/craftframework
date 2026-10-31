import assert from 'node:assert/strict'
import { buildStructure, templateNodes, type TemplateNode } from './networkTemplates.ts'
import { canNest, validGeoCode } from './networks.ts'

const top = { level: 'national' as const, name: 'Kenya', geoCode: 'KE' }
const ALL = ['DZ', 'NG', 'KE', 'ZA', 'CD', 'SN', 'MA', 'EG', 'ET', 'GH'] // spread across regions and RECs
const shapes: Array<[string, TemplateNode[]]> = [
  ...(['blank', 'africa-regions-countries', 'nigeria-zones-states', 'cohort'] as const).map((t) => [t, templateNodes(t, top)] as [string, TemplateNode[]]),
  ['kenya counties', buildStructure({ countries: ['KE'], grouping: 'none', zones: false, subdivisions: true })],
  ['nigeria zones', buildStructure({ countries: ['NG'], grouping: 'none', zones: true, subdivisions: true })],
  ['multi au', buildStructure({ countries: ALL, grouping: 'au-region', zones: true, subdivisions: true })],
  ['multi rec', buildStructure({ countries: ALL, grouping: 'rec', zones: false, subdivisions: false })],
  ['multi none', buildStructure({ countries: ALL, grouping: 'none', zones: false, subdivisions: true })],
]
for (const [t, nodes] of shapes) {
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
const ke = buildStructure({ countries: ['KE'], grouping: 'none', zones: false, subdivisions: true })
assert.equal(ke[0].geoCode, 'KE'); assert.equal(ke.length, 48, 'Kenya and its 47 counties')
assert.equal(buildStructure({ countries: ['NG'], grouping: 'none', zones: true, subdivisions: true }).length, 1 + 6 + 37)
assert.equal(buildStructure({ countries: ['NG'], grouping: 'none', zones: false, subdivisions: true }).filter((n) => n.level === 'zonal').length, 0)
const au = buildStructure({ countries: ALL, grouping: 'au-region', zones: false, subdivisions: false })
assert.equal(au[0].level, 'continental'); assert.equal(au.filter((n) => n.level === 'subregional').length, 5); assert.equal(au.filter((n) => n.level === 'national').length, 10)
assert.ok(buildStructure({ countries: ALL, grouping: 'rec', zones: false, subdivisions: false }).some((n) => n.name === 'ECOWAS'))
const everything = buildStructure({ countries: [...new Set(africa.filter((n) => n.level === 'national').map((n) => n.geoCode))], grouping: 'au-region', zones: true, subdivisions: true })
assert.ok(everything.length < 1500, `whole continent stays manageable (${everything.length})`)
assert.throws(() => buildStructure({ countries: ['XX'], grouping: 'none', zones: false, subdivisions: false }))
console.log('networkTemplates.test.ts ok')
