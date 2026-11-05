// Self-check — run directly with `node src/lib/cca/crosswalk.test.ts`.
import assert from 'node:assert/strict'
import { evidencedLevel, indicativeLevel } from './crosswalk.ts'

assert.deepEqual(indicativeLevel(0), { score: 1, level: 'Nascent' })
assert.deepEqual(indicativeLevel(100), { score: 4, level: 'Mature' })
assert.deepEqual(indicativeLevel(50), { score: 2.5, level: 'Expanding' })
assert.equal(indicativeLevel(30).level, 'Emerging')
assert.equal(indicativeLevel(60).level, 'Expanding')
assert.equal(indicativeLevel(150).score, 4, 'clamped')

const st = (id: string) => [{ id, text: id }]
const mod = { id: 'community', name: 'Community', audience: 'x', areas: [{ id: 'a', name: 'A', domains: ['d1', 'd2', 'd3'].map((d) => ({ id: d, name: d, level1: 'x', levels: { 2: st(`${d}.2`), 3: st(`${d}.3`), 4: st(`${d}.4`) } })) }] }
const ok = { met: true, evidence: 'seen' }
const full = { 'd1.2': ok, 'd1.3': ok, 'd1.4': ok, 'd2.2': ok, 'd2.3': ok, 'd3.2': ok }
const list = [
  { module: 'community', year: 2025, status: 'complete', responses: {}, completedAt: '2025-06-01' },
  { module: 'community', year: 2026, status: 'complete', responses: full, completedAt: '2026-06-01' },
  { module: 'community', year: 2027, status: 'draft', responses: full, completedAt: null },
  { module: 'pre_award', year: 2028, status: 'complete', responses: full, completedAt: '2028-01-01' },
]
assert.deepEqual(evidencedLevel(list, [mod]), { module: 'community', year: 2026, score: 3, level: 'Expanding' }, 'latest completed, not drafts or grant stages')
assert.equal(evidencedLevel([], [mod]), null)

console.log('cca/crosswalk.test.ts: all assertions passed')
