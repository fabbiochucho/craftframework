// Self-check for public benchmarks: small groups never published, counts banded, self vs validated kept apart.
import assert from 'node:assert/strict'
import { band, benchmarksCsv, computeBenchmarks, type BenchmarkInput } from './benchmarks.ts'

const row = (over: Partial<BenchmarkInput>): BenchmarkInput => ({ module: 'community', country: 'NG', sector: 'Health', archetype: 'Civil Society', size: 'small', validated: false, average: 2, ...over })
const rows = [
  ...[1, 2, 2.5, 3, 3.5, 4].map((average, i) => row({ average, validated: i >= 3 })),
  ...[2, 2, 2, 2, 2].map((average) => row({ country: 'KE', average })),
  row({ country: 'GH', average: 4, sector: 'Education' }), // a lone Ghanaian organisation must never be visible on its own
]
const data = computeBenchmarks(rows, [{ id: 'community', name: 'Community' }, { id: 'national', name: 'National' }], new Date('2026-11-26T00:00:00Z'))

assert.equal(data.modules.length, 1, 'a module with no group of five is not published')
const m = data.modules[0]
assert.equal(m.overall!.organisations, '10–19')
const countries = m.dimensions.country.map((g) => g.value)
assert.deepEqual(countries, ['KE', 'NG'], 'Ghana (1) is not shown; Other (1) is below five and not shown either')
assert.equal(m.dimensions.country.find((g) => g.value === 'NG')!.stats.organisations, '5–9')
const ng = m.dimensions.country.find((g) => g.value === 'NG')!.stats
assert.equal(ng.selfAssessed, null, 'three self-assessed is under five')
assert.equal(ng.validated, null)
assert.deepEqual(m.dimensions.sector.map((g) => g.value), ['Health'])
assert.ok(!JSON.stringify(data).includes('"min"') && !JSON.stringify(data).includes('"max"'), 'no extremes are published')
assert.equal(band(4), 'fewer than 5')
assert.equal(band(150), '100+')
const csv = benchmarksCsv(data)
assert.ok(csv.startsWith('module,dimension'))
assert.ok(!csv.includes('GH'))
console.log('benchmarks ok')
