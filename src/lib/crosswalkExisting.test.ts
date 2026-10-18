// Self-check: `node src/lib/crosswalkExisting.test.ts`
import assert from 'node:assert/strict'
import { MOCK_QUESTIONS } from './data.ts'
import { LADDER_INDICATORS } from './capitalReadiness.ts'
import { ESG_QUESTIONS } from './esg.ts'
import { crosswalkProblems } from './crosswalk.ts'
import { CORE_DOMAIN_REFS, ESG_PILLAR_REFS, INDICATOR_CATALOGUE, LADDER_DOMAIN_REFS, MODULE_DIMENSION_REFS, indicatorsFor } from './crosswalkExisting.ts'
import { FOUNDATION_MODULES } from './foundationModules.ts'

for (const d of new Set(MOCK_QUESTIONS.map((q) => q.domain))) assert.ok(CORE_DOMAIN_REFS[d]?.length, `core domain mapped: ${d}`)
for (const d of new Set(LADDER_INDICATORS.map((q) => q.domain))) assert.ok(LADDER_DOMAIN_REFS[d]?.length, `ladder domain mapped: ${d}`)
for (const m of FOUNDATION_MODULES.filter((x) => !x.version)) for (const d of m.dimensions) assert.ok(MODULE_DIMENSION_REFS[`${m.id}:${d.key}`]?.length, `module dimension mapped: ${m.id}:${d.key}`)
for (const p of new Set(ESG_QUESTIONS.map((q) => q.pillar))) assert.ok(ESG_PILLAR_REFS[p]?.length, `ESG pillar mapped: ${p}`)

const ids = INDICATOR_CATALOGUE.map((e) => e.id)
assert.equal(new Set(ids).size, ids.length, 'catalogue ids unique across sources')
assert.equal(INDICATOR_CATALOGUE.length, MOCK_QUESTIONS.length + LADDER_INDICATORS.length + ESG_QUESTIONS.length + FOUNDATION_MODULES.reduce((n, m) => n + m.indicators.length, 0))
assert.deepEqual(crosswalkProblems(INDICATOR_CATALOGUE.map((e) => ({ indicatorId: e.id, refs: e.refs }))), [])
assert.ok(indicatorsFor('iso-27001').some((e) => e.source === 'core'), 'core cyber questions support ISO 27001 readiness')
assert.ok(indicatorsFor('coso-ic', 'CE').some((e) => e.id === 'CRAFT-FCR-01'), 'new index refs flow through')
const pfm = INDICATOR_CATALOGUE.find((e) => e.id === 'CRAFT-FCR-25')!
assert.equal(pfm.applies({}), false)
assert.equal(pfm.applies({ publicBody: true }), true)
console.log('crosswalkExisting: ok')
