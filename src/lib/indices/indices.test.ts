// Self-check: `node src/lib/indices/indices.test.ts`
import assert from 'node:assert/strict'
import { crosswalkProblems } from '../crosswalk.ts'
import { ORGANISATIONAL_HEALTH } from './organisationalHealth.ts'
import { CHANGE_READINESS } from './changeReadiness.ts'
import { FIDUCIARY_CONTROLS } from './fiduciaryControls.ts'
import { esScreening, SAFEGUARDS } from './safeguards.ts'
import { applicableIndicators } from '../foundationModules.ts'
import type { FoundationModule } from '../foundationModules.ts'

export function checkIndex(m: FoundationModule, prefix: string, expected: number) {
  assert.equal(m.indicators.length, expected, `${m.id}: indicator count`)
  assert.equal(m.version, 'v1 (102026)')
  assert.ok(!m.preview, `${m.id}: live for organisations (founder sign-off 2026-10-18)`)
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
checkIndex(CHANGE_READINESS, 'CHG', 18)
checkIndex(FIDUCIARY_CONTROLS, 'FCR', 27)
assert.equal(FIDUCIARY_CONTROLS.specialist, 'fiduciary')
assert.equal(applicableIndicators(FIDUCIARY_CONTROLS, {}).length, 24, 'PFM hidden unless public body')
assert.equal(applicableIndicators(FIDUCIARY_CONTROLS, { publicBody: true }).length, 27)
assert.ok(FIDUCIARY_CONTROLS.indicators.filter((i) => i.dimension === 'pfm').every((i) => i.appliesWhen?.publicBody))
checkIndex(SAFEGUARDS, 'ESS', 25)
assert.equal(SAFEGUARDS.specialist, 'safeguards')
const none = { physicalWorks: false, largeWorkforce: false, sensitiveLocation: false, acquiresLand: false, nearProtectedArea: false, nearHeritage: false, lendsOrInvests: false }
assert.deepEqual(esScreening(none), { category: 'low', flags: [] })
assert.deepEqual(esScreening({ ...none, largeWorkforce: true }), { category: 'moderate', flags: [] })
assert.deepEqual(esScreening({ ...none, physicalWorks: true, acquiresLand: true }), { category: 'high', flags: ['land'] })
assert.deepEqual(esScreening({ ...none, lendsOrInvests: true, nearHeritage: true }), { category: 'low', flags: ['heritage', 'intermediary'] })
const low = applicableIndicators(SAFEGUARDS, { esCategory: 'low', esFlags: [] }).map((i) => i.dimension)
assert.deepEqual([...new Set(low)].sort(), ['community', 'esms', 'labour', 'stakeholders'], 'low risk: core system, labour, SEAH and stakeholders')
const moderate = applicableIndicators(SAFEGUARDS, { esCategory: 'moderate', esFlags: ['land'] }).map((i) => i.dimension)
assert.deepEqual([...new Set(moderate)].sort(), ['community', 'esms', 'labour', 'land', 'resources', 'stakeholders', 'vulnerable'])
assert.equal(applicableIndicators(SAFEGUARDS, {}).length, 0, 'nothing scores before the screening is done')
// Checkpoint 2 review fixes
const lowIds = applicableIndicators(SAFEGUARDS, { esCategory: 'low', esFlags: [] }).map((x) => x.id)
assert.ok(lowIds.includes('CRAFT-ESS-12'), 'SEAH/GBV is asked of every organisation, whatever its risk category')
assert.ok(!lowIds.includes('CRAFT-ESS-04') && !lowIds.includes('CRAFT-ESS-05'), 'climate board oversight and sustainability reporting start at moderate risk')
for (const m of [ORGANISATIONAL_HEALTH, CHANGE_READINESS, FIDUCIARY_CONTROLS, SAFEGUARDS])
  for (const x of m.indicators)
    assert.ok(!/(most frauds|where most fraud|more than any other|far more than|immediate loss of funding)/i.test(`${x.whyItMatters} ${x.recommendation}`), `${x.id}: no unsourced statistics`)
// Task 7: registration and the preview gate
import { FOUNDATION_MODULES } from '../foundationModules.ts'
import { canSeePreview, FRAMEWORKS } from '../frameworks.ts'
const allIds = FOUNDATION_MODULES.flatMap((m) => m.indicators.map((x) => x.id))
assert.equal(new Set(allIds).size, allIds.length, 'indicator ids unique across all modules')
for (const fid of ['craft-health', 'craft-change', 'craft-fiduciary', 'craft-safeguards']) {
  assert.ok(FOUNDATION_MODULES.some((m) => m.id === fid), `${fid} in FOUNDATION_MODULES`)
  assert.ok(!FRAMEWORKS.find((f) => f.id === fid)?.preview, `${fid} live for organisations`)
}
assert.equal(canSeePreview('super_admin'), true)
assert.equal(canSeePreview('admin'), false)
assert.equal(canSeePreview(undefined), false)
console.log('indices: ok')

// Stage 2: high-risk safeguards cap (spec 2.4)
import { bandFor } from '../foundationModules.ts'
const allFives = Object.fromEntries(SAFEGUARDS.indicators.map((x) => [x.id, 5]))
const highRisk = { esCategory: 'high' as const, esFlags: [] }
assert.equal(bandFor(SAFEGUARDS, allFives, highRisk)?.band.label, 'Developing', 'high risk without an independent assessment caps at Developing')
assert.match(bandFor(SAFEGUARDS, allFives, highRisk)?.capReason ?? '', /independent/i)
assert.equal(bandFor(SAFEGUARDS, allFives, { ...highRisk, esIndependentAssessment: true })?.band.label, 'Exemplary')
assert.equal(bandFor(SAFEGUARDS, allFives, { esCategory: 'moderate', esFlags: [] })?.band.label, 'Exemplary', 'moderate risk is not capped')
console.log('indices (stage 2): ok')

// CRAFT-ONC (networks plan step 3): pan-African organisational and network capacity
import { CRAFT_ONC, ONC_LAW_AREAS, byNhocatDomain, maturityLevel } from './craftOnc.ts'
import { LAW_AREAS } from '../laws/types.ts'
{
  const m = CRAFT_ONC
  assert.equal(m.indicators.length, 44)
  const dims = new Set(m.dimensions.map((d) => d.key))
  m.indicators.forEach((i, n) => {
    assert.equal(i.id, `CRAFT-ONC-${String(n + 1).padStart(2, '0')}`, 'ids sequential')
    assert.ok(dims.has(i.dimension))
    for (const s of [0, 1, 2, 3, 4, 5]) assert.ok((i.soe as Record<number, string>)[s]?.length > 10, `${i.id}: descriptor ${s}`)
    assert.ok(i.evidence && i.recommendation && i.whyItMatters && (i.minWeeks ?? 0) >= 2)
    assert.ok(!/\b(certif|complian)/i.test(`${i.question} ${i.soe[5]}`), `${i.id}: no certification/compliance claims`)
    // Written for any African country: no country-specific bodies in the wording
    assert.ok(!/\b(CAC|SCUML|FIRS|NACA|PAYE|NSITF|ICAN|Nigeria|Kenya)\b/.test(`${i.question} ${Object.values(i.soe).join(' ')} ${i.evidence}`), `${i.id}: country-neutral`)
  })
  for (const d of m.dimensions) assert.equal(m.indicators.filter((i) => i.dimension === d.key).length, 4, `${d.key}: four indicators`)
  assert.deepEqual(crosswalkProblems(m.indicators.map((i) => ({ indicatorId: i.id, refs: i.crosswalk ?? [] }))), [])
  for (const l of m.lenses) for (const x of l.indicatorIds) assert.ok(m.indicators.some((i) => i.id === x))
  for (const [k, areas] of Object.entries(ONC_LAW_AREAS)) {
    assert.ok(m.indicators.some((i) => i.id === k), `${k}: law areas for a real indicator`)
    for (const a of areas) assert.ok(a in LAW_AREAS, `${k}: known law area ${a}`)
  }
  // Every NHOCAT domain is covered by at least two indicators
  const all = Object.fromEntries(m.indicators.map((i) => [i.id, 3]))
  for (const d of byNhocatDomain(all)) assert.ok(d.answered >= 2 && d.score === 3, `NHOCAT ${d.domain} covered`)
  assert.deepEqual(byNhocatDomain({}).map((d) => d.score), Array(8).fill(null))
  assert.deepEqual([0, 1.74, 1.75, 2.74, 2.75, 3.74, 3.75, 5].map(maturityLevel),
    ['Latent', 'Latent', 'Emerging', 'Emerging', 'Established', 'Established', 'Advanced', 'Advanced'])
  assert.ok(m.preview, 'preview until founders sign off the content')
  console.log('indices (CRAFT-ONC): ok')
}
