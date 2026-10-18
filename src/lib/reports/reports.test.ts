// Self-check: `node src/lib/reports/reports.test.ts`
import assert from 'node:assert/strict'
import { buildAlignmentReport } from './alignmentReport.ts'
import { buildIndexReport } from './indexReport.ts'
import { buildIsoReadiness } from './isoReadiness.ts'
import { ATTRIBUTION_NOTICE, ISO_STATEMENT } from './legal.ts'
import { SAFEGUARDS } from '../indices/safeguards.ts'

// Alignment: nothing answered = not assessed, never gap (Review Focus 1)
const empty = buildAlignmentReport('coso-ic', {}, {})
assert.equal(empty.title, 'Alignment with COSO Internal Control — Integrated Framework (2013) principles (CRAFT mapping)')
assert.ok(empty.elements.every((e) => e.coverage === 'not-assessed' || e.coverage === 'not-mapped'), 'no gaps without answers')
assert.equal(empty.footer, ATTRIBUTION_NOTICE)
// Scores drive coverage
const r = buildAlignmentReport('coso-ic', { 'CRAFT-FCR-01': 5, 'CRAFT-FCR-03': 5 }, {})
assert.equal(r.elements.find((e) => e.id === 'CE')?.coverage, 'covered')
const low = buildAlignmentReport('coso-ic', { 'CRAFT-FCR-01': 0, 'CRAFT-FCR-03': 1 }, {})
assert.equal(low.elements.find((e) => e.id === 'CE')?.coverage, 'gap')
assert.equal(low.counts.gap >= 1, true)
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
// Only CRAFT's own labels are checked: mapped question text is the organisation's assessment wording.
const labels = JSON.stringify({ statement: iso.statement, standards: iso.standards.map((s) => ({ name: s.name, kind: s.kind, readiness: s.readiness })) })
assert.ok(!/\b(certified|compliant|passes)\b/i.test(labels), 'report labels never claim certification or compliance')
console.log('reports: ok')
