// Self-check: `node src/lib/indices/indices.test.ts`
import assert from 'node:assert/strict'
import { crosswalkProblems } from '../crosswalk.ts'
import { ORGANISATIONAL_HEALTH } from './organisationalHealth.ts'
import type { FoundationModule } from '../foundationModules.ts'

export function checkIndex(m: FoundationModule, prefix: string, expected: number) {
  assert.equal(m.indicators.length, expected, `${m.id}: indicator count`)
  assert.equal(m.version, 'v1 (102026)')
  assert.equal(m.preview, true, `${m.id}: hidden until founder sign-off`)
  const dims = new Set(m.dimensions.map((d) => d.key))
  m.indicators.forEach((i, n) => {
    assert.equal(i.id, `CRAFT-${prefix}-${String(n + 1).padStart(2, '0')}`, 'ids sequential')
    assert.ok(dims.has(i.dimension), `${i.id}: known dimension`)
    for (const s of [0, 1, 2, 3, 4, 5]) assert.ok((i.soe as Record<number, string>)[s]?.length > 10, `${i.id}: descriptor ${s}`)
    assert.ok(i.evidence && i.recommendation && i.whyItMatters, `${i.id}: evidence, recommendation, why`)
    assert.equal(i.version, 'v1 (102026)')
    assert.ok(i.actionType && (i.minWeeks ?? 0) >= 2, `${i.id}: actionType and minWeeks`)
    assert.ok((i.crosswalk ?? []).length > 0, `${i.id}: at least one crosswalk ref`)
    assert.ok(!/\b(certif|complian)/i.test(`${i.question} ${i.soe[5]}`), `${i.id}: no certification/compliance claims`)
  })
  for (const d of m.dimensions) assert.ok(m.indicators.some((i) => i.dimension === d.key), `${d.key}: has indicators`)
  for (const l of m.lenses) for (const id of l.indicatorIds) assert.ok(m.indicators.some((i) => i.id === id), `${l.key}: ${id}`)
  assert.deepEqual(crosswalkProblems(m.indicators.map((i) => ({ indicatorId: i.id, refs: i.crosswalk ?? [] }))), [])
}

checkIndex(ORGANISATIONAL_HEALTH, 'OHE', 24)
console.log('indices: ok')
