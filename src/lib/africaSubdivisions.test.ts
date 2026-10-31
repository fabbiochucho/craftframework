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
console.log('africaSubdivisions.test.ts ok')
