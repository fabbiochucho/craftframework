// Self-check — run directly with `node src/lib/africa-countries.test.ts`.
import assert from 'node:assert/strict'
import { AFRICA_COUNTRIES, countriesBy } from './africa-countries.ts'

assert.equal(AFRICA_COUNTRIES.length, 54)
assert.equal(new Set(AFRICA_COUNTRIES.map((c) => c.iso2)).size, 54)
assert.equal(countriesBy((c) => c.aprm).length, 45, 'APRM lists 45 member states')
assert.equal(countriesBy((c) => c.monetaryUnion === 'WAEMU').length, 8)
assert.equal(countriesBy((c) => c.monetaryUnion === 'CEMAC').length, 6)
assert.equal(countriesBy((c) => c.ohada).length, 17)
assert.equal(countriesBy((c) => c.rcc === 'East').length, 14, 'Eastern RCC covers 14 states')
assert.deepEqual(countriesBy((c) => c.ifrs !== 'none').map((c) => c.iso2).sort(), ['GH', 'KE', 'NG', 'RW', 'TZ', 'UG', 'ZM', 'ZW'])
console.log('africa-countries.test.ts: all assertions passed')
