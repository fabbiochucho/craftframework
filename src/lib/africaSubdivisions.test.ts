import assert from 'node:assert/strict'
import { AFRICA_SUBDIVISIONS } from './africaSubdivisions.ts'
import { AFRICA_COUNTRIES } from './africa-countries.ts'
import { validGeoCode } from './networks.ts'

for (const c of AFRICA_COUNTRIES) {
  const subs = AFRICA_SUBDIVISIONS[c.iso2]
  assert.ok(subs?.length, `${c.name} has subdivisions`)
  assert.equal(new Set(subs.map(([code]) => code)).size, subs.length, `${c.name}: unique codes`)
  for (const [code, name] of subs) {
    assert.ok(validGeoCode('subnational', `${c.iso2}-${code}`), `${c.iso2}-${code}`)
    assert.ok(name.trim() === name && name.length > 0, `${c.iso2}-${code} name`)
  }
}
assert.equal(Object.keys(AFRICA_SUBDIVISIONS).length, 54)
assert.equal(AFRICA_SUBDIVISIONS.KE.length, 47, 'Kenya: 47 counties')
// Current boundaries, not the ones they replaced
assert.equal(AFRICA_SUBDIVISIONS.CD.length, 26, 'DR Congo: 26 provinces since 2015')
assert.equal(AFRICA_SUBDIVISIONS.CI.length, 14, "Côte d'Ivoire: 12 districts and 2 autonomous districts")
assert.equal(AFRICA_SUBDIVISIONS.DZ.length, 58, 'Algeria: 58 wilayas')
assert.equal(AFRICA_SUBDIVISIONS.TZ.length, 31, 'Tanzania: 31 regions')
assert.equal(AFRICA_SUBDIVISIONS.BF.length, 13, 'Burkina Faso: regions, not provinces')
assert.deepEqual(AFRICA_SUBDIVISIONS.ET.map(([c]) => c).filter((c) => ['SI', 'SW', 'CE', 'SE', 'SN'].includes(c)).sort(), ['CE', 'SE', 'SI', 'SW'], 'Ethiopia: SNNPR replaced by its 2023 successors')
assert.equal(AFRICA_SUBDIVISIONS.ET.length, 14, 'Ethiopia: 12 regions and 2 chartered cities')
assert.equal(AFRICA_SUBDIVISIONS.NG.length, 37, 'Nigeria: 36 states and the FCT')
console.log('africaSubdivisions.test.ts ok')
