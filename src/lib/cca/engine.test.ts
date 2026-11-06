// Self-check — run directly with `node src/lib/cca/engine.test.ts`.
import assert from 'node:assert/strict'
import {
  ADDED_LATER, previousAssessment, reassessmentsDue, unexplainedMisses, availableReports, rollup, awardReadiness, cascade, dashboard, domainScore, effectiveNotAssessed, entryCost, growthLevel, improvementPlan, nextLevelGaps, percentOfMax, planReview,
  resolveVotes, swotSeed, voteSpread, type CcaModule, type Domain, type Responses,
} from './engine.ts'

const dom = (id: string, critical = false): Domain => ({
  id, name: `Domain ${id}`, level1: 'Nothing in place.', critical,
  levels: { 2: [{ id: `${id}.2a`, text: `${id} level 2 a` }, { id: `${id}.2b`, text: `${id} level 2 b` }], 3: [{ id: `${id}.3a`, text: `${id} level 3 a` }], 4: [{ id: `${id}.4a`, text: `${id} level 4 a` }] },
})
const ok = { met: true, evidence: 'Seen: signed minutes' }
const m: CcaModule = { id: 'test', name: 'Test', audience: 'Test', areas: [
  { id: 'A', name: 'Area A', domains: [dom('A1', true), dom('A2')] },
  { id: 'B', name: 'Area B', domains: [dom('B1')] },
] }

// Cumulative, evidence-gated scoring.
assert.equal(domainScore(dom('X'), {}), 1, 'level 1 needs nothing')
assert.equal(domainScore(dom('X'), { 'X.2a': ok }), 1, 'every statement in a level is needed')
assert.equal(domainScore(dom('X'), { 'X.2a': ok, 'X.2b': ok }), 2)
assert.equal(domainScore(dom('X'), { 'X.2a': ok, 'X.2b': ok, 'X.3a': { met: true, evidence: '  ' } }), 2, 'met without evidence does not count')
assert.equal(domainScore(dom('X'), { 'X.2a': ok, 'X.2b': ok, 'X.4a': ok }), 2, 'cannot skip a level')
const full: Responses = { 'X.2a': ok, 'X.2b': ok, 'X.3a': ok, 'X.4a': ok }
assert.equal(domainScore(dom('X'), full), 4)
assert.deepEqual(nextLevelGaps(dom('X'), { 'X.2a': ok }).map((s) => s.id), ['X.2b'])
assert.deepEqual(nextLevelGaps(dom('X'), full), [])

// Growth levels: share of the maximum, half-open bands (up to 25%, 50%, 75%, above), no gaps.
assert.deepEqual([0, 1, 1.01, 2, 2.01, 3, 3.01, 4].map(growthLevel), ['Not assessed', 'Nascent', 'Emerging', 'Emerging', 'Expanding', 'Expanding', 'Mature', 'Mature'])
assert.deepEqual([1, 2, 3, 4].map(percentOfMax), [25, 50, 75, 100])

// Dashboard.
const r: Responses = { 'A1.2a': ok, 'A1.2b': ok, 'A1.3a': ok, 'A1.4a': ok, 'A2.2a': ok, 'A2.2b': ok }
const d = dashboard(m, r)
assert.deepEqual(d.areas.map((a) => [a.total, a.average, a.percent, a.level]), [[6, 3, 75, 'Expanding'], [1, 1, 25, 'Nascent']])
assert.deepEqual([d.total, d.average, d.percent, d.level], [7, 2, 50, 'Emerging'], 'overall is the average of the areas, each counting equally')
// One area at 1.5 and six at 1 averages 1.07: Emerging, not Nascent.
const seven: CcaModule = { id: 's', name: 'S', audience: 'S', areas: ['P', 'Q', 'R', 'S', 'T', 'U', 'V'].map((x) => ({ id: x, name: x, domains: [dom(`${x}1`), dom(`${x}2`)] })) }
const s7 = dashboard(seven, { 'P1.2a': ok, 'P1.2b': ok })
assert.deepEqual([s7.average, s7.level], [1.07, 'Emerging'])

// Not assessed: left out of the area and overall averages, listed in the plan, skipped in the cascade.
const na = dashboard(m, r, { B1: 'Not relevant: no field programmes this year' })
assert.deepEqual([na.areas[1].level, na.areas[1].domains[0].assessed, na.average, na.level], ['Not assessed', false, 3, 'Expanding'])
assert.deepEqual(dashboard(m, r, { A2: 'Records with the auditors' }).areas[0].average, 4)
const naPlan = improvementPlan(m, r, [], { B1: 'Not relevant' })
assert.deepEqual([naPlan.rows.map((x) => x.domainId), naPlan.toAssess.map((x) => x.domainId)], [['A2'], ['B1']])
assert.deepEqual(swotSeed(na).weaknesses, [], 'a domain not assessed is not a weakness')

// Domains added after an assessment was completed do not lower its result.
assert.deepEqual(effectiveNotAssessed(m, { A2: 'Skipped' }, ['A1', 'A2']), { B1: ADDED_LATER, A2: 'Skipped' })
assert.deepEqual(effectiveNotAssessed(m, { A2: 'Skipped' }, null), { A2: 'Skipped' }, 'drafts and older rows: as stored')
assert.equal(dashboard(m, r, effectiveNotAssessed(m, {}, ['A1', 'A2'])).average, 3, 'B1 (added later) left out')

// Improvement plan: one level up, actions from unmet statements, costs totalled.
const plan = improvementPlan(m, r, [{ domainId: 'A2', costs: 1500, timeline: 'Q2', responsible: 'Finance lead' }, { domainId: 'B1', costs: 500 }])
assert.deepEqual(plan.rows.map((x) => [x.domainId, x.current, x.envisioned]), [['A2', 2, 3], ['B1', 1, 2]])
assert.deepEqual(plan.rows[1].actions, ['B1 level 2 a', 'B1 level 2 b'])
assert.deepEqual([plan.totalCost, plan.byArea.A, plan.byArea.B], [2000, 1500, 500])
assert.equal(improvementPlan(m, r, [{ domainId: 'A2', costs: -5 }]).totalCost, 0, 'negative costs are ignored')
// Cost lines replace the single figure; training is per participant.
const lined = improvementPlan(m, r, [
  { domainId: 'A2', costs: 9999, lines: { technicalAssistance: 1000, trainingPerParticipant: 50, participants: 12, printing: 200, exchangeVisits: -3 } },
  { domainId: 'B1', lines: { eLearning: 300, trainingPerParticipant: 40 } },
])
assert.deepEqual(lined.rows.map((x) => x.cost), [1000 + 600 + 200, 300 + 40], 'one participant when none given; negatives ignored')
assert.deepEqual([lined.byLine.trainingPerParticipant, lined.byLine.eLearning, lined.totalCost, lined.byArea.A], [640, 300, 2140, 1800])
assert.equal(entryCost(undefined).total, 0)
const review = planReview(plan.rows, dashboard(m, { ...r, 'A2.3a': ok }))
assert.deepEqual(review.map((x) => [x.domainId, x.met]), [['A2', true], ['B1', false]])

// Facilitated scoring (Approach I): highest vote that the evidence supports.
assert.deepEqual(voteSpread([4, 3, 3, 2]), { 1: 0, 2: 1, 3: 2, 4: 1 })
assert.equal(resolveVotes([4, 3, 3, 2], 4), 4)
assert.equal(resolveVotes([4, 3, 3, 2], 3), 3, 'falls back to the most-voted supported score')
assert.equal(resolveVotes([4, 2, 2, 3], 3), 2, 'most votes first among supported scores')
assert.equal(resolveVotes([4, 4], 2), 2, 'never above the evidence')

// Multi-year tracking.
const rec = (year: number, extra: Responses = {}) => ({ year, dashboard: dashboard(m, { ...r, ...extra }) })
assert.deepEqual(availableReports([rec(2026)]), ['yearly'])
assert.deepEqual(availableReports([rec(2026), rec(2027), rec(2028)]), ['yearly', 'mid_term'])
assert.deepEqual(availableReports([2026, 2027, 2028, 2029, 2030].map((y) => rec(y))), ['yearly', 'mid_term', 'five_year'])
assert.deepEqual(availableReports([rec(2026), rec(2030), rec(2031)]), ['yearly'], 'mid-term needs three consecutive years')
const c = cascade([rec(2026), rec(2027, { 'B1.2a': ok, 'B1.2b': ok })])
assert.deepEqual(c.map((x) => [x.areaId, x.trend]), [['A', 'steady'], ['B', 'improving']])
const skipped = cascade([{ year: 2026, dashboard: na }, rec(2027)])
assert.deepEqual(skipped[1].series.map((x) => x.year), [2027])

// Award readiness: critical domains gate it.
assert.equal(awardReadiness(m, {}).rating, 'not_yet_ready')
const w = awardReadiness(m, r)
assert.equal(w.rating, 'ready_with_conditions')
assert.deepEqual(w.conditions.map((x) => x.domainId), ['B1'])
const allMet: Responses = Object.fromEntries(['A1', 'A2', 'B1'].flatMap((x) => [`${x}.2a`, `${x}.2b`, `${x}.3a`, `${x}.4a`]).map((k) => [k, ok]))
assert.equal(awardReadiness(m, allMet).rating, 'ready')

// SWOT seed.
assert.deepEqual(swotSeed(d), { strengths: ['Domain A1'], weaknesses: ['Domain B1'], opportunities: [], threats: [] })

// Roll-up: per region and overall; areas averaged over places that assessed them; places count equally.
const placeA = { region: 'Kano', district: 'Dala', dashboard: dashboard(m, r) }               // areas 3 and 1
const placeB = { region: 'Kano', district: 'Fagge', dashboard: dashboard(m, allMet) }         // areas 4 and 4
const placeC = { region: 'Lagos', district: 'Ikeja', dashboard: dashboard(m, r, { B1: 'x x' }) } // area A 3; B not assessed
const ru = rollup([placeA, placeB, placeC])
assert.deepEqual(ru.byRegion.map((g) => [g.region, g.places, g.areas.map((a) => a.average), g.average]), [['Kano', 2, [3.5, 2.5], 3], ['Lagos', 1, [3, 0], 3]])
assert.deepEqual([ru.overall!.places, ru.overall!.areas.map((a) => a.average), ru.overall!.level], [3, [3.33, 2.5], 'Expanding'])
assert.deepEqual(rollup([]), { byRegion: [], overall: null })

// 12-month reassessment: the previous assessment for the same module and place; due a year after completion.
const ref = (id: string, year: number, status: string, completedAt: string | null, extra = {}) => ({ id, module: 'community', year, awardRef: '', region: '', district: '', status, completedAt, ...extra })
const hist = [ref('a24', 2024, 'complete', '2024-06-01T00:00:00Z'), ref('a25', 2025, 'complete', '2025-06-01T00:00:00Z'), ref('k25', 2025, 'complete', '2025-01-01T00:00:00Z', { region: 'Kano' })]
assert.equal(previousAssessment(hist, ref('a26', 2026, 'draft', null))?.id, 'a25')
assert.equal(previousAssessment(hist, ref('x', 2026, 'draft', null, { region: 'Kano' }))?.id, 'k25', 'same place only')
assert.equal(previousAssessment(hist, ref('a24', 2024, 'draft', null)), null)
assert.deepEqual(reassessmentsDue(hist, '2026-05-31').map((d) => d.last.id), ['k25'])
assert.deepEqual(reassessmentsDue(hist, '2026-06-01').map((d) => [d.last.id, d.dueOn]), [['a25', '2026-06-01'], ['k25', '2026-01-01']])
assert.deepEqual(reassessmentsDue([...hist, ref('a26', 2026, 'draft', null)], '2026-07-01').map((d) => d.last.id), ['k25'], 'a started reassessment clears it')
// The gate: every missed target needs an explanation.
const missed = [{ domainId: 'A2', envisioned: 3 as const, reached: 2 as const, met: false }, { domainId: 'B1', envisioned: 2 as const, reached: 2 as const, met: true }]
assert.deepEqual(unexplainedMisses(missed, {}), ['A2'])
assert.deepEqual(unexplainedMisses(missed, { A2: 'Funding for the audit was cut' }), [])

console.log('cca/engine.test.ts: all assertions passed')
