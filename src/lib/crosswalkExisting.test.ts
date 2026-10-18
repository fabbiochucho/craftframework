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
// Checkpoint 1: mappings a funder would find wrong
const has = (rows: Record<string, { framework: string; ref: string }[]>, k: string, fw: string, ref: string) => rows[k].some((r) => r.framework === fw && r.ref === ref)
assert.ok(!has(CORE_DOMAIN_REFS, 'Sustainability & Financing', 'ifrs-s1', 'STRAT'), 'resource mobilisation is not sustainability disclosure')
assert.ok(!has(CORE_DOMAIN_REFS, 'Grant Management', 'pefa', 'V'), 'donor grants are not government budget execution')
assert.ok(has(CORE_DOMAIN_REFS, 'USG Compliance', 'coso-ic', 'CE') && has(CORE_DOMAIN_REFS, 'International Donor Compliance', 'gf-pr', 'TOOL'))
assert.ok(!has(LADDER_DOMAIN_REFS, 'Legal Structure & Registration', 'ifc-cgdf', 'COMMIT'), 'legal constitution is not commitment to governance')
// Strengthened links: the cascade, not one perspective, at domain level; perspectives on the questions that name them
const entry = (id: string) => INDICATOR_CATALOGUE.find((e) => e.id === id)!
const refd = (id: string, fw: string, ref: string) => entry(id).refs.some((r) => r.framework === fw && r.ref === ref)
assert.ok(has(CORE_DOMAIN_REFS, 'Strategy & Planning', 'bsc', 'CASCADE') && !has(CORE_DOMAIN_REFS, 'Strategy & Planning', 'bsc', 'FINANCIAL'))
for (const id of ['SP-04', 'SP-05', 'SP-06']) for (const p of ['FINANCIAL', 'CUSTOMER', 'PROCESS', 'LEARNING']) assert.ok(refd(id, 'bsc', p), `${id} → bsc:${p}`)
assert.ok(refd('SP-15', 'bsc', 'FINANCIAL') && refd('SP-13', 'bsc', 'LEARNING'))
assert.ok(!refd('SP-13', 'bsc', 'FINANCIAL'), 'a culture question is not the financial perspective')
assert.ok(refd('SP-13', 'mck-7s', 'STRATEGY'), 'question-level refs add to the domain refs')
// Emergency preparedness: risk response, not ERM performance as a whole
assert.ok(!has(CORE_DOMAIN_REFS, 'Emergency Preparedness', 'coso-erm', 'PF'))
for (const id of ['EPR-02', 'EPR-08', 'EPR-13', 'EPR-20']) assert.ok(refd(id, 'coso-erm', 'P13') && refd(id, 'iso-31000', '6.5'), `${id} → risk response`)
assert.ok(refd('EPR-03', 'coso-erm', 'P16') && refd('EPR-03', 'coso-erm', 'P17'))
assert.ok(!refd('EPR-01', 'coso-erm', 'P13') && refd('EPR-01', 'iso-22301', 'MS'))
// Every mapping says why
for (const e of INDICATOR_CATALOGUE) for (const r of e.refs) assert.ok(e.rationale[`${r.framework}:${r.ref}`]?.length > 10, `rationale for ${e.id} → ${r.framework}:${r.ref}`)
assert.match(entry('SP-15').rationale['bsc:FINANCIAL'], /budget/i)
console.log('crosswalkExisting: ok')
