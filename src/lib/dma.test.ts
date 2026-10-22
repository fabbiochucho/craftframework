// Self-check: `node src/lib/dma.test.ts` — the ESRS double materiality assessment.
import assert from 'node:assert/strict'
import {
  DMA_TOPICS, DEFAULT_THRESHOLDS, emptyAssessment, esrsMatters, impactScore, financialScore, isMaterial, dmaResult,
  likelihoodFromFair, suggestEsgG5, dmaNarrativeBlocks, type DmaMatter, type DmaAssessment, type ImpactAssessment,
} from './dma.ts'

// The illustrative ESRS topic list (revised ESRS: illustrative, not mandatory)
assert.deepEqual(DMA_TOPICS.map((t) => t.standard), ['E1', 'E2', 'E3', 'E4', 'E5', 'S1', 'S2', 'S3', 'S4', 'G1'])
assert.ok(DMA_TOPICS.every((t) => t.subTopics.length > 0))
assert.equal(esrsMatters().length, DMA_TOPICS.length, 'one starting matter per topic')
assert.deepEqual(DEFAULT_THRESHOLDS, { impact: 3, financial: 3 }, 'thresholds start at the middle of the 1-5 scale')

// Impact materiality: severity = scale, scope, irremediability (negative only); likelihood applies to potential impacts
const neg: ImpactAssessment = { kind: 'actual', effect: 'negative', scale: 4, scope: 3, irremediability: 5, valueChain: ['own'] }
assert.equal(impactScore(neg), 4, 'actual: severity alone (mean of 4, 3, 5)')
assert.equal(impactScore({ ...neg, kind: 'potential', likelihood: 2 }), 1.6, 'potential: severity x likelihood / 5')
assert.equal(impactScore({ ...neg, kind: 'potential', likelihood: 1, humanRights: true }), 4, 'human-rights impacts: severity takes precedence over likelihood')
assert.equal(impactScore({ kind: 'actual', effect: 'positive', scale: 3, scope: 5, valueChain: ['downstream'] }), 4, 'positive: scale and scope only')
assert.equal(impactScore(undefined), null)

// Financial materiality: magnitude x likelihood / 5
assert.equal(financialScore({ kind: 'risk', trigger: 'carbon tax', magnitude: 5, likelihood: 4 }), 4)
assert.equal(financialScore(undefined), null)
// A linked FAIR scenario supplies the likelihood from the chance of any loss in a year
assert.deepEqual([0.95, 0.6, 0.3, 0.1, 0.01].map(likelihoodFromFair), [5, 4, 3, 2, 1])

// Materiality: either side at or above its threshold, or a recorded top-down conclusion
const matter = (over: Partial<DmaMatter>): DmaMatter => ({ id: 'm', topic: 'E1', name: 'Climate change', source: 'esrs', ...over })
const t = DEFAULT_THRESHOLDS
assert.equal(isMaterial(matter({ impact: neg }), t), true)
assert.equal(isMaterial(matter({ financial: { kind: 'risk', trigger: 'x', magnitude: 2, likelihood: 2 } }), t), false)
assert.equal(isMaterial(matter({ topDown: { material: false, reason: 'No operations in water-stressed areas' } }), t), false)
assert.equal(isMaterial(matter({ topDown: { material: true, reason: 'Core to the business model' } }), t), true)
assert.equal(isMaterial(matter({}), t), null, 'not yet assessed')
assert.equal(isMaterial(matter({ topDown: { material: false, reason: '  ' } }), t), null, 'a top-down conclusion needs a reason')

// The result: material matters, the ESRS standards to report (IRO-2), omitted topics with reasons, and the method used
const a: DmaAssessment = {
  ...emptyAssessment(), matters: [
    matter({ id: 'e1', impact: neg, financial: { kind: 'risk', trigger: 'carbon pricing', magnitude: 4, likelihood: 4 } }),
    matter({ id: 's1', topic: 'S1', name: 'Own workforce', impact: { kind: 'actual', effect: 'negative', scale: 2, scope: 2, irremediability: 1, valueChain: ['own'] } }),
    matter({ id: 'e3', topic: 'E3', name: 'Water and marine resources', topDown: { material: false, reason: 'Office-based; no water-intensive activity' } }),
    matter({ id: 'x1', topic: 'entity', name: 'Donor dependency', source: 'entity', financial: { kind: 'risk', trigger: 'grant cuts', magnitude: 5, likelihood: 4 } }),
  ],
}
const r = dmaResult(a)
assert.deepEqual(r.material.map((m) => m.id), ['e1', 'x1'])
assert.deepEqual(r.standards, ['ESRS 2', 'E1'], 'ESRS 2 always, plus topical standards with a material matter; entity-specific matters are reported under ESRS 2')
assert.deepEqual(r.notMaterial.map((m) => m.id), ['s1', 'e3'])
assert.equal(r.unassessed.length, 0)
assert.equal(r.method, 'mixed', 'some matters scored, some concluded top-down')

// ESG-G5 (materiality) suggestion follows the evidence
assert.equal(suggestEsgG5(emptyAssessment()).level, 0)
assert.equal(suggestEsgG5(a).level, 2, 'assessed, but no stakeholder input or approval recorded')
assert.equal(suggestEsgG5({ ...a, stakeholders: 'Staff survey; two community meetings' }).level, 3)
assert.equal(suggestEsgG5({ ...a, stakeholders: 'Staff survey', approvedBy: 'Board, 12 Sept 2026' }).level, 5, 'both sides assessed and board-approved')

// Report section: process (IRO-1), material impacts, risks and opportunities, and the disclosures covered (IRO-2)
const blocks = dmaNarrativeBlocks({ ...a, stakeholders: 'Staff survey', approvedBy: 'Board' })
const text = JSON.stringify(blocks)
for (const s of ['IRO-1', 'IRO-2', 'Donor dependency', 'Office-based; no water-intensive activity', 'middle of the scale']) assert.ok(text.includes(s), s)
assert.ok(blocks.some((b) => b.type === 'note' && /2026\/1563/.test(b.text)), 'names the ESRS version applied')
assert.doesNotMatch(text, /\bcompliant\b/i, 'readiness, never "compliant"')

console.log('dma: ok')
