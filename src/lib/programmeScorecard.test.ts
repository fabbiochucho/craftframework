import assert from 'node:assert/strict'
import { COMPONENTS, TEMPLATES, allItemIds, bandFor, changeSince, scoreUnit, summarise, templateById, validEntry, type UnitResult } from './programmeScorecard.ts'

// Templates are well formed: every area has items for all four components; ids unique
for (const t of TEMPLATES) {
  const ids = allItemIds(t)
  assert.equal(new Set(ids).size, ids.length, `${t.id}: unique item ids`)
  for (const a of t.areas) for (const c of COMPONENTS) assert.ok(a.items[c].length >= 3, `${t.id}/${a.key}/${c}: items`)
  assert.ok(t.source.length > 20)
}
const t = templateById('hiv-prevention-subnational')!
assert.deepEqual(t.areas.map((a) => a.key), ['agyw', 'condom'])
// NACA's public report items for AGYW programme management are present
assert.ok(t.areas[0].items.management.some((i) => /technical working group/i.test(i.text)))
assert.ok(t.areas[0].items.implementation.some((i) => /population estimation/i.test(i.text)))

// Bands (CRAFT thresholds)
assert.deepEqual([0, 39, 40, 69, 70, 100].map(bandFor), ['immediate', 'immediate', 'attention', 'attention', 'good', 'good'])

// Validation: known items, 0-2 only
assert.ok(validEntry(t, { 'agyw.m1': 2, 'condom.o3': 0 }))
assert.ok(!validEntry(t, { 'agyw.m1': 3 }))
assert.ok(!validEntry(t, { 'nope.m1': 1 }))

// Scoring: unanswered counts as 0; gaps list what isn't fully in place
const full = Object.fromEntries(allItemIds(t).map((id) => [id, 2]))
const r = scoreUnit(t, { ...full, 'agyw.m1': 0, 'agyw.m2': 1 })
const mgmt = r[0].components.find((c) => c.component === 'management')!
assert.equal(mgmt.pct, 70)
assert.equal(mgmt.band, 'good')
assert.equal(mgmt.gaps.length, 2)
assert.equal(scoreUnit(t, {})[0].components[0].band, 'immediate')

// NACA-style summary: counts, by zone, lists
const unit = (nodeId: string, name: string, group: string, s: Record<string, number>): UnitResult => ({ nodeId, name, group, result: scoreUnit(t, s) })
const units = [unit('la', 'Lagos', 'South West', full), unit('oy', 'Oyo', 'South West', {}), unit('kn', 'Kano', 'North West', { 'agyw.m1': 2, 'agyw.m2': 2, 'agyw.m3': 1 })]
const s = summarise(units, 'agyw', 'management')
assert.deepEqual(s.counts, { immediate: 1, attention: 1, good: 1 })
assert.deepEqual(s.byGroup, [{ group: 'North West', immediate: 0, attention: 1, good: 0 }, { group: 'South West', immediate: 1, attention: 0, good: 1 }])
assert.deepEqual(s.lists, { immediate: ['Oyo'], attention: ['Kano'], good: ['Lagos'] })

// Change between scorecards
const ch = changeSince(t, [{ nodeId: 'oy', scores: {} }, { nodeId: 'la', scores: full }], [{ nodeId: 'oy', scores: full }, { nodeId: 'la', scores: full }, { nodeId: 'new', scores: {} }])
assert.equal(ch.comparedUnits, 2)
assert.equal(ch.improved, 8, 'Oyo moved up in all 8 area-components')
assert.equal(ch.worsened, 0)
assert.equal(ch.same, 8)

console.log('programmeScorecard.test.ts ok')
