// Self-check — run directly with `node src/lib/framework-map.test.ts`.
import assert from 'node:assert/strict'
import { A2063_GOALS, APRM_AREAS, FRAMEWORK_MAP, rowsForSdg, SDG_GOALS, SDG_TARGETS } from './framework-map.ts'
import { GOVERNANCE_PILLARS } from './craft-governance.ts'
import { PSP } from './public-sector.ts'
import { assessmentTypesFor, catalogueByType } from './assessment-catalogues.ts'
import { catalogueScore } from './health-security.ts'

// Every reference in the map resolves.
for (const row of FRAMEWORK_MAP) {
  for (const t of row.sdg) { assert.ok(SDG_TARGETS[t], `${row.element}: SDG ${t}`); assert.ok(SDG_GOALS[t.split('.')[0]], `goal for ${t}`) }
  for (const g of row.a2063) assert.ok(A2063_GOALS[g], g)
  for (const a of row.aprm) assert.ok(APRM_AREAS[a], a)
}
// Every CRAFT-GS pillar and every PSP section is mapped, with the real pillar names.
for (const p of Object.values(GOVERNANCE_PILLARS)) assert.equal(FRAMEWORK_MAP.find((r) => r.framework === 'CRAFT-GS' && r.element === p.id)?.label, p.name)
for (const s of PSP.sections) assert.ok(FRAMEWORK_MAP.some((r) => r.framework === 'PSP' && r.element === s.id), s.id)
assert.ok(rowsForSdg('16').length > rowsForSdg('16.5').length)
assert.ok(rowsForSdg('3.d').some((r) => r.element === 'SPAR'))

// PSP: 29 items, OECD-DAC has six criteria plus evaluation practice; availability by organisation type.
assert.equal(PSP.items.length, 29)
assert.equal(PSP.items.filter((i) => /^DAC[1-6]$/.test(i.id)).length, 6)
assert.equal(PSP.items.filter((i) => i.sectionId === 'pfm').length, 7, 'seven PEFA pillars')
assert.deepEqual(assessmentTypesFor('government'), ['PSP'])
assert.ok(assessmentTypesFor('nphi').includes('PSP') && assessmentTypesFor('nphi').includes('SPAR'))
assert.deepEqual(assessmentTypesFor('private'), [])
assert.equal(catalogueScore(catalogueByType('PSP')!, { PEFA1: { score: 4, evidence: true, notApplicable: false } }).sections.find((s) => s.id === 'pfm')!.percent, 80)
console.log('framework-map.test.ts: all assertions passed')
