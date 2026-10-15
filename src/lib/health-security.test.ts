// Self-check — run directly with `node src/lib/health-security.test.ts`.
import assert from 'node:assert/strict'
import { SPAR_LEVELS } from './spar-levels.ts'
import { activeItems, catalogueScore, CROSSWALK, crosswalkView, healthSecurityTypesFor, JEE, JEE_SUB, NPHI, SPAR } from './health-security.ts'

// Catalogue structure matches the WHO tools.
assert.equal(JEE.items.length, 19, 'JEE 3rd edition: 19 technical areas')
assert.equal(SPAR.sections.length, 15, 'SPAR 2nd edition: 15 capacities')
assert.equal(SPAR.items.length, 35, 'SPAR 2nd edition: 35 indicators')
assert.equal(NPHI.items.filter((i) => i.sectionId === 'functions').length, 10, '10 NPHI core functions')
for (const c of [NPHI, JEE, SPAR]) assert.equal(new Set(c.items.map((i) => i.id)).size, c.items.length)
for (const row of CROSSWALK) {
  for (const j of row.jee) assert.ok(JEE.items.some((i) => i.id === j), j)
  for (const n of row.nphi) assert.ok(NPHI.items.some((i) => i.id === n), n)
  if (row.spar) assert.ok(SPAR.sections.some((s) => s.id === row.spar), row.spar)
}
assert.deepEqual([...new Set(CROSSWALK.flatMap((r) => r.jee))].sort(), JEE.items.map((i) => i.id).sort(), 'every JEE area is on the crosswalk')

// SPAR method: indicator % = level × 20; capacity = mean; overall = mean of capacities.
const spar = catalogueScore(SPAR, { 'C1.1': { score: 3, evidence: false, notApplicable: false }, 'C1.2': { score: 4, evidence: false, notApplicable: false }, 'C3.1': { score: 5, evidence: false, notApplicable: false } })
assert.equal(spar.sections.find((s) => s.id === 'C1')!.percent, 70)
assert.equal(spar.sections.find((s) => s.id === 'C3')!.percent, 50, 'unanswered C3.2 counts as zero (WHO rule)')
assert.equal(spar.overall, 8, 'mean over all 15 capacities: (70 + 50) / 15')
assert.equal(spar.completeness, 9)
assert.match(spar.sdg!.indicator, /3\.d\.1/)

// NPHI: evidence cap 2, N/A excluded, Centre of Excellence section only when in scope.
assert.equal(activeItems(NPHI, false).some((i) => i.sectionId === 'coe'), false)
assert.equal(activeItems(NPHI, true).filter((i) => i.sectionId === 'coe').length, 10)
const n = catalogueScore(NPHI, { A1: { score: 5, evidence: false, notApplicable: false }, A2: { score: 4, evidence: true, notApplicable: false }, A3: { score: null, evidence: false, notApplicable: true, naReason: 'x' } })
assert.equal(n.items.find((i) => i.id === 'A1')!.effective, 2)
assert.equal(n.sections.find((s) => s.id === 'attributes')!.percent, 60, 'mean of 40 and 80')
assert.equal(n.sections.find((s) => s.id === 'attributes')!.total, 7)
assert.deepEqual(n.priorities.map((p) => p.id), ['A1'])
assert.deepEqual(n.critical.map((c) => c.id), ['CF2', 'CF8', 'CF10', 'E9'])

// Crosswalk joins the three and reports the spread.
const jee = catalogueScore(JEE, { P1: { score: 2, evidence: false, notApplicable: false } })
const nphi = catalogueScore(NPHI, { A6: { score: 4, evidence: true, notApplicable: false }, E9: { score: 5, evidence: true, notApplicable: false } })
const legal = crosswalkView({ SPAR: spar, JEE: jee, NPHI: nphi }).find((r) => r.spar === 'C1')!
assert.deepEqual([legal.sparPercent, legal.jeePercent, legal.nphiPercent, legal.spread], [70, 40, 90, 50])
// Subnational JEE: the 19 JEE areas plus three subnational items; availability by organisation type.
assert.equal(JEE_SUB.items.length, 22)
assert.ok(JEE_SUB.items.every((i) => JEE_SUB.sections.some((s) => s.id === i.sectionId)))
assert.deepEqual(healthSecurityTypesFor('subnational'), ['JEE_SUB', 'AAR', 'SIMEX'])
assert.ok(healthSecurityTypesFor('nphi').includes('SPAR'))
assert.deepEqual(healthSecurityTypesFor('government'), [])
// Every SPAR indicator has five level summaries with a WHO page reference.
assert.deepEqual(Object.keys(SPAR_LEVELS).sort(), SPAR.items.map((i) => i.id).sort())
for (const [id, v] of Object.entries(SPAR_LEVELS)) { assert.equal(v.levels.length, 5, id); assert.ok(v.page >= 6 && v.page <= 46, id) }
console.log('health-security.test.ts: all assertions passed')
