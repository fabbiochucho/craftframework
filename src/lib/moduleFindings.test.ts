// Self-check: `node src/lib/moduleFindings.test.ts`
import assert from 'node:assert/strict'
import { deriveModuleFindings, derivePlan, planTimeline } from './moduleFindings.ts'
import { DEFAULT_TIMELINE } from './cipTimeline.ts'
import { computeOrgScore, deriveFindings } from './data.ts'

const scores = { 'CRAFT-OHE-01': 1, 'CRAFT-OHE-02': 4, 'CRAFT-FCR-25': 0, 'CRAFT-RES-01': 0 }
const f = deriveModuleFindings(scores, {}, 24)
assert.deepEqual(f.map((x) => x.id), ['CRAFT-OHE-01'], 'only answered, applicable v1 index gaps (not older modules, not PFM for non-public bodies)')
assert.ok(f[0].mitigation.length > 10)
assert.equal(f[0].owner, 'Board Secretary', 'policy actions owned by the board secretary')
assert.equal(f[0].topic, 'Organisational Effectiveness Index')
assert.deepEqual(deriveModuleFindings(scores, { publicBody: true }, 24).map((x) => x.id).sort(), ['CRAFT-FCR-25', 'CRAFT-OHE-01'])
assert.deepEqual(deriveModuleFindings({}, {}, 24), [], 'nothing answered, nothing added')
// The core plan and score are untouched by index answers
const core = { 'GOV-01': 1 }
assert.equal(computeOrgScore({ ...core, ...scores }), computeOrgScore(core), 'index answers never change the core composite')
assert.ok(!deriveFindings({ ...core, ...scores }).some((x) => x.id.startsWith('CRAFT-')), 'core plan never contains index ids')
// One plan, sorted together (checkpoint 1)
const mixed = derivePlan({ 'GOV-01': 3, 'GOV-02': 2, 'CRAFT-OHE-01': 0 }, {}, 24)
assert.equal(mixed[0].id, 'CRAFT-OHE-01', 'a critical index gap sorts above core high/moderate gaps')
// Stage 3: dates come from the suggested timeline (Ruling: replaces "two criticals get different months")
const twoCritical = derivePlan({ 'GOV-01': 0, 'CRAFT-OHE-01': 0 }, {}, DEFAULT_TIMELINE)
for (const x of twoCritical) assert.ok(x.dueWeek! > 0 && x.dueWeek! <= 26 && x.phase === 1, `${x.id} is a critical gap, closed early in phase 1`)
assert.equal(twoCritical.find((x) => x.id === 'CRAFT-OHE-01')!.actionType, 'policy', 'index actions carry their action type')
const dated = derivePlan({ 'GOV-01': 0 }, {}, { ...DEFAULT_TIMELINE, startDate: '2027-01-04' })
assert.match(dated[0].dueDate, /^2027-\d{2}-\d{2}$/, 'with a start date, due dates are real dates')
const t = planTimeline({ 'GOV-01': 3, 'GOV-02': 2 }, {}, DEFAULT_TIMELINE)
assert.equal(t.planMonths, Math.max(...t.actions.map((x) => x.dueMonth)), 'plan length is when the last action is due')
// A number is the old plan-length argument: the Target date pace
const legacy = planTimeline({ 'GOV-01': 3 }, {}, 6)
assert.ok(legacy.planMonths <= 6, 'a 6-month target keeps a moderate gap within 6 months')
// Low change readiness slows people and practice actions
const chg = 'CRAFT-CHG-01'
assert.ok(planTimeline({ 'GOV-01': 0, [chg]: 0 }, {}, DEFAULT_TIMELINE).actions.find((x) => x.id === chg)!.flags!.some((f) => /embedding/.test(f)) ||
  !planTimeline({ [chg]: 0 }, {}, DEFAULT_TIMELINE).actions.some((x) => ['people', 'practice'].includes(x.actionType ?? '')), 'change readiness feeds the timeline')
console.log('moduleFindings: ok')

import { deriveEsgFindings } from './moduleFindings.ts'
// Review Focus 4: no ESG scores means the plan is unchanged
assert.deepEqual(derivePlan({ 'GOV-01': 0 }, {}, 24), derivePlan({ 'GOV-01': 0 }, {}, 24, 2, {}))
// Only gaps up to the next stage; unanswered criteria are not actions
const esg = { 'ESG-E3': 3, 'ESG-S1': 3, 'ESG-G1': 3, 'ESG-G2': 1, 'ESG-G5': 2, 'ESG-N3': 0 }
const ef = deriveEsgFindings(esg, 24)
assert.deepEqual(ef.map((f) => f.id).sort(), ['ESG-G2', 'ESG-G5'], 'stage-4 gap ESG-N3 is not added while stage 1 is incomplete (Review Focus 3)')
assert.equal(ef.find((f) => f.id === 'ESG-G2')!.severity, 'Critical')
assert.equal(ef.find((f) => f.id === 'ESG-G5')!.severity, 'High')
assert.ok(derivePlan({}, {}, 24, 2, esg).some((f) => f.id === 'ESG-G2'), 'ESG actions reach the plan')
console.log('moduleFindings (ESG): ok')
