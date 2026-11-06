// Self-check — run directly with `node src/lib/methodologies.test.ts`.
import assert from 'node:assert/strict'
import { METHODOLOGIES, methodologyById, methodologyConclusion, reportFindings } from './methodologies.ts'
import { LADDER_INDICATORS } from './capitalReadiness.ts'
import { MASTER_COMPLIANCE_MATRIX } from './dataroom.ts'

// Six templates; every weighted domain is a real ladder domain; every evidence id exists in the requirement list.
assert.equal(METHODOLOGIES.length, 6)
const domains = new Set(LADDER_INDICATORS.map((i) => i.domain))
const docs = new Set(MASTER_COMPLIANCE_MATRIX.map((r) => r.id))
for (const m of METHODOLOGIES) {
  for (const d of [...Object.keys(m.weights), ...m.keyDomains]) assert.ok(domains.has(d), `${m.id}: unknown domain ${d}`)
  for (const e of m.evidence) assert.ok(docs.has(e), `${m.id}: unknown document ${e}`)
  assert.ok(m.thresholds.ready > m.thresholds.conditional)
}

const g2g = methodologyById('g2g_readiness')!
const all = (score: number) => Object.keys(g2g.weights).map((domain) => ({ domain, final: score }))
assert.equal(methodologyConclusion(g2g, all(4)).conclusion, 'Ready')             // 80%
assert.equal(methodologyConclusion(g2g, all(3)).conclusion, 'Ready subject to conditions') // 60%
assert.equal(methodologyConclusion(g2g, all(2)).conclusion, 'Not yet ready')     // 40%
// A weak key domain caps a high score at the middle conclusion.
const weak = all(5).map((s) => (s.domain === 'Basic Financial Controls' ? { ...s, final: 2 } : s))
const r = methodologyConclusion(g2g, weak)
assert.deepEqual([r.conclusion, r.weakKeyDomains], ['Ready subject to conditions', ['Basic Financial Controls']])
// Unscored domains are limitations, not zeros; domains outside the methodology are ignored.
const partial = methodologyConclusion(g2g, [{ domain: 'Basic Financial Controls', final: 4 }, { domain: 'Community Legitimacy', final: 0 }, { domain: 'Auditable Financial Records', final: null }])
assert.deepEqual([partial.percent, partial.scoredDomains], [80, 1])
assert.ok(partial.missingDomains.includes('Auditable Financial Records'))
assert.equal(methodologyConclusion(g2g, []).conclusion, 'Not yet ready')
assert.equal(methodologyById('nope'), undefined)
// Report findings: a written finding, short evidence, a score below the self-assessment, or a qualification.
const ind = (id: string, x: object) => ({ id, final: 3, self: 3, sufficiency: 'sufficient', comment: '', qualifications: [] as string[], ...x })
assert.deepEqual(reportFindings([ind('a', {}), ind('b', { comment: 'Minutes unsigned' }), ind('c', { sufficiency: 'partial' }), ind('d', { final: 2 }), ind('e', { qualifications: ['Q1'] }), ind('f', { final: 4 })]).map((x) => x.id), ['b', 'c', 'd', 'e'])
console.log('methodologies.test.ts: all assertions passed')
