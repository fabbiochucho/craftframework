// Self-check: `node src/lib/assurance.test.ts` — sustainability assurance readiness (limited and reasonable).
import assert from 'node:assert/strict'
import {
  ASSURANCE_PHASES, CONTROLS, defaultItems, readiness, currentPhase, nextStep, checkClaims, emptyPlan, assuranceNarrativeBlocks,
  type AssuranceItem, type AssurancePlan,
} from './assurance.ts'

const all = Object.fromEntries(CONTROLS.map((c) => [c.key, true])) as AssuranceItem['controls']
const none = Object.fromEntries(CONTROLS.map((c) => [c.key, false])) as AssuranceItem['controls']
const item = (over: Partial<AssuranceItem>): AssuranceItem => ({ id: 'x', name: 'X', kind: 'metric', current: 'none', target: 'limited', controls: none, ...over })

// The three phases: limited on the whole report, reasonable on core metrics, then reasonable broadly
assert.equal(ASSURANCE_PHASES.length, 3)
assert.match(ASSURANCE_PHASES[0].name, /limited/i)

// Starting items: the whole report, Scope 1 and 2 emissions, and each material topic from the double materiality assessment
const items = defaultItems(['Climate change (E1)', 'Own workforce (S1)'])
assert.deepEqual(items.map((i) => i.kind), ['report', 'metric', 'topic', 'topic'])
assert.match(items[1].name, /Scope 1 and 2/)

// Readiness from the controls in place: three basics for limited, all of them for reasonable
assert.equal(readiness(item({})).ready, 'none')
assert.ok(readiness(item({})).missingForLimited.length === 3)
const basics = { ...none, methodology: true, owner: true, auditTrail: true }
assert.equal(readiness(item({ controls: basics })).ready, 'limited')
assert.equal(readiness(item({ controls: basics })).missingForReasonable.length, 3)
assert.equal(readiness(item({ controls: all })).ready, 'reasonable')

// Phase reached and the next step
const plan = (its: AssuranceItem[]): AssurancePlan => ({ ...emptyPlan(), items: its })
assert.equal(currentPhase(plan([item({ kind: 'report' })])), 0)
assert.equal(currentPhase(plan([item({ kind: 'report', current: 'limited' }), item({ kind: 'metric', current: 'limited' })])), 1)
assert.equal(currentPhase(plan([item({ kind: 'report', current: 'limited' }), item({ kind: 'metric', current: 'reasonable' })])), 2)
assert.equal(currentPhase(plan([item({ kind: 'report', current: 'reasonable' }), item({ kind: 'metric', current: 'reasonable' }), item({ kind: 'topic', current: 'reasonable' })])), 3)
assert.match(nextStep(plan([item({ kind: 'report' })])), /limited assurance on the whole report/i)

// Claims: limited assurance must not be described as an audit or as reasonable-level comfort
const limitedOnly = plan([item({ kind: 'report', current: 'limited' })])
assert.equal(checkClaims('Our report received limited assurance under ISSA 5000.', limitedOnly).length, 0)
assert.ok(checkClaims('Our sustainability report was audited.', limitedOnly).some((f) => /audit/i.test(f)))
assert.ok(checkClaims('We obtained reasonable assurance over all metrics.', limitedOnly).some((f) => /reasonable/i.test(f)))
assert.ok(checkClaims('The figures are guaranteed accurate.', limitedOnly).length > 0)
assert.ok(checkClaims('Our emissions are independently assured.', plan([item({ kind: 'report' })])).some((f) => /no assurance/i.test(f)))
assert.equal(checkClaims('Emissions had reasonable assurance.', plan([item({ kind: 'metric', current: 'reasonable' })])).length, 0)

// Report section: explains what limited assurance is, the plan per item, and the CSRD position
const text = JSON.stringify(assuranceNarrativeBlocks(plan([item({ name: 'Whole sustainability report', kind: 'report', current: 'limited', target: 'limited', standard: 'ISSA 5000' })])))
for (const s of ['lower', 'not an audit', 'Whole sustainability report', 'ISSA 5000', 'limited assurance only']) assert.ok(text.includes(s), s)
assert.doesNotMatch(text, /\bcompliant\b/i)

console.log('assurance: ok')
