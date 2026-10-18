// Self-check: `node src/lib/reports/reports.test.ts`
import assert from 'node:assert/strict'
import { alignmentAvailable, buildAlignmentReport } from './alignmentReport.ts'
import { indicatorsFor } from '../crosswalkExisting.ts'
import { COVERAGE_LABEL } from './coverage.ts'
import { buildIndexReport } from './indexReport.ts'
import { buildIsoReadiness } from './isoReadiness.ts'
import { ATTRIBUTION_NOTICE, ISO_STATEMENT } from './legal.ts'
import { SAFEGUARDS } from '../indices/safeguards.ts'

// Alignment: nothing answered = not assessed, never gap (Review Focus 1)
const empty = buildAlignmentReport('coso-ic', {}, {})
assert.equal(empty.title, 'Alignment with COSO Internal Control — Integrated Framework (2013) (CRAFT mapping)')
assert.ok(empty.elements.every((e) => e.coverage === 'not-assessed' || e.coverage === 'not-mapped'), 'no gaps without answers')
assert.equal(empty.footer, ATTRIBUTION_NOTICE)
// Scores drive coverage
// Two strong answers out of many mapped questions is not "Covered" (checkpoint 2, critical)
const r = buildAlignmentReport('coso-ic', { 'CRAFT-FCR-01': 5, 'CRAFT-FCR-03': 5 }, {})
const ce = r.elements.find((e) => e.id === 'CE')!
assert.equal(ce.coverage, 'partial', 'too few answers to call it covered')
assert.equal(ce.answered, 2)
assert.ok(ce.applicable > 2)
// Answer every applicable question mapped to an element: covered
const p3 = indicatorsFor('coso-ic', 'P3').filter((e) => e.applies({}) && !e.lens)
const allAnswered = Object.fromEntries(p3.map((e) => [e.id, 5]))
assert.equal(buildAlignmentReport('coso-ic', allAnswered, {}).elements.find((e) => e.id === 'P3')?.coverage, 'covered')
// Lens questions count only when the lens is switched on
const lensEntry = indicatorsFor('ifrs-s2', 'GOV').find((e) => e.lens)
assert.ok(lensEntry, 'climate lens questions map to IFRS S2 governance')
const withoutLens = buildAlignmentReport('ifrs-s2', {}, {}).elements.find((e) => e.id === 'GOV')!
const withLens = buildAlignmentReport('ifrs-s2', {}, {}, [lensEntry!.lens!]).elements.find((e) => e.id === 'GOV')!
assert.ok(withLens.applicable > withoutLens.applicable, 'switching the lens on adds its questions')
assert.equal(COVERAGE_LABEL['not-mapped'], 'No CRAFT question mapped')
assert.equal(alignmentAvailable('coso-ic'), true)
assert.equal(alignmentAvailable('pact-omt'), false, 'frameworks with fewer than 5 mapped questions are not offered')
// Two low answers out of many: a gap, but on limited evidence
const low = buildAlignmentReport('coso-ic', { 'CRAFT-FCR-01': 0, 'CRAFT-FCR-03': 1 }, {})
assert.equal(low.elements.find((e) => e.id === 'CE')?.coverage, 'gap-limited')
assert.equal(COVERAGE_LABEL['gap-limited'], 'Gap (limited evidence)')
assert.equal(low.counts['gap-limited'] >= 1, true)
const p3zero = buildAlignmentReport('coso-ic', Object.fromEntries(p3.map((e) => [e.id, 0])), {})
assert.equal(p3zero.elements.find((e) => e.id === 'P3')?.coverage, 'gap', 'enough low answers: a gap')
// Non-applicable (Review Focus 2): a PFM indicator for a non-public body
const pefa = buildAlignmentReport('pefa', { 'CRAFT-FCR-27': 1 }, {})
const v = pefa.elements.find((e) => e.id === 'V')!
assert.ok(!v.indicators.some((x) => x.id === 'CRAFT-FCR-27'), 'non-applicable indicators are not listed')
assert.notEqual(v.coverage, 'gap', 'a non-applicable low score never creates a gap')
const onlyPfm = buildAlignmentReport('pefa', {}, {}).elements.find((e) => e.id === 'III')!
assert.equal(onlyPfm.coverage, 'not-applicable', 'an element mapped only to non-applicable questions is not applicable')

// Index report respects the high-risk cap (Review Focus 3)
const fives = Object.fromEntries(SAFEGUARDS.indicators.map((x) => [x.id, 5]))
const ir = buildIndexReport(SAFEGUARDS, fives, { esCategory: 'high', esFlags: [] }, 24)
assert.equal(ir.band?.band.label, 'Developing')
assert.equal(ir.version, 'v1 (102026)')
const gapsReport = buildIndexReport(SAFEGUARDS, { 'CRAFT-ESS-01': 1 }, { esCategory: 'low', esFlags: [] }, 24)
assert.deepEqual(gapsReport.actions.map((a) => a.id), ['CRAFT-ESS-01'], 'index report lists the plan actions it created')

// ISO readiness
const iso = buildIsoReadiness(['iso-27001', 'iso-31000'], { 'CRAFT-FCR-19': 1 }, {})
assert.equal(iso.statement, ISO_STATEMENT)
assert.equal(iso.footer, ATTRIBUTION_NOTICE)
assert.equal(iso.standards.find((s) => s.id === 'iso-31000')?.kind, 'guidance')
assert.match(iso.standards.find((s) => s.id === 'iso-31000')!.note, /not certifiable/i)
assert.match(iso.standards.find((s) => s.id === 'iso-27001')!.note, /accredited certification bodies/i)
assert.match(buildIsoReadiness(['iso-14064-1'], {}, {}).standards[0].note, /verif/i)
assert.deepEqual(buildIsoReadiness(['coso-ic', 'iso-27001'], {}, {}).standards.map((s) => s.id), ['iso-27001'], 'only ISO standards')
assert.ok(buildIsoReadiness(['iso-9001'], {}, {}).standards[0].related.length > 0, 'ISO 9001 is named in the statement, so CRAFT questions must map to it')
// Only CRAFT's own labels are checked: mapped question text is the organisation's assessment wording.
const labels = JSON.stringify({ statement: iso.statement, standards: iso.standards.map((s) => ({ name: s.name, kind: s.kind, readiness: s.readiness })) })
assert.ok(!/\b(certified|compliant|passes)\b/i.test(labels), 'report labels never claim certification or compliance')
console.log('reports: ok')

// Final review: index report dates match the plan; older indices say they don't feed the plan
import { derivePlan } from '../moduleFindings.ts'
import { FOUNDATION_MODULES } from '../foundationModules.ts'
import { ORGANISATIONAL_HEALTH } from '../indices/organisationalHealth.ts'
const busy: Record<string, number> = { 'CRAFT-OHE-01': 0 }
for (const id of ['GOV-01', 'GOV-02', 'GOV-03', 'GOV-04', 'GOV-05', 'GOV-06', 'GOV-07', 'GOV-08']) busy[id] = 0
const planDue = derivePlan(busy, {}, 24).find((a) => a.id === 'CRAFT-OHE-01')!.dueMonth
const reportDue = buildIndexReport(ORGANISATIONAL_HEALTH, busy, {}, 24).actions.find((a) => a.id === 'CRAFT-OHE-01')!.dueMonth
assert.equal(reportDue, planDue, 'the index report and the plan give the same due date')
const resilience = FOUNDATION_MODULES.find((m) => m.id === 'craft-resilience')!
assert.equal(buildIndexReport(resilience, {}, {}, 24).feedsPlan, false)
assert.equal(buildIndexReport(ORGANISATIONAL_HEALTH, {}, {}, 24).feedsPlan, true)
console.log('reports (final review): ok')

// Stage 2 additions: lenses named on reports; unanswered index has no composite; every element says why it is mapped
assert.equal(buildAlignmentReport('coso-ic', {}, {}).lensNote, 'Thematic lenses included: none')
assert.match(buildAlignmentReport('ifrs-s2', {}, {}, [lensEntry!.lens!]).lensNote, /^Thematic lenses included: \w/)
assert.ok(!/none/.test(buildIsoReadiness(['iso-14001'], {}, {}, [lensEntry!.lens!]).lensNote))
assert.equal(buildIndexReport(ORGANISATIONAL_HEALTH, {}, {}, 24).composite, null, 'nothing answered: no composite, not 0')
const bscCascade = buildAlignmentReport('bsc', {}, {}).elements.find((e) => e.id === 'CASCADE')!
assert.ok(bscCascade.rationale.length > 0 && bscCascade.rationale.every((t) => t.length > 10))
const bscFin = buildAlignmentReport('bsc', {}, {}).elements.find((e) => e.id === 'FINANCIAL')!
assert.ok(bscFin.rationale.some((t) => /budget/i.test(t)), 'question-level reasons reach the report')
console.log('reports (stage 2 additions): ok')

assert.match(ATTRIBUTION_NOTICE, /TNFD/, 'TNFD named in the attribution notice')
console.log('reports (TNFD attribution): ok')
