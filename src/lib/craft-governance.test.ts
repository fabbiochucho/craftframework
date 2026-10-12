// Self-check — run directly with `node src/lib/craft-governance.test.ts`.
import assert from 'node:assert/strict'
import {
  activeCriteria, craftScorecard, validationDelta, criterionById, DEFAULT_PILLAR_WEIGHTS, GOVERNANCE_CRITERIA, GOVERNANCE_PILLARS, METHODOLOGY, validateScoringInputs,
  type CriterionResponse,
} from './craft-governance.ts'

// Default configuration is valid: weights sum to 100, every pillar has criteria, ids unique, sources unverified.
assert.deepEqual(validateScoringInputs(DEFAULT_PILLAR_WEIGHTS, {}).errors, [])
assert.equal(Object.keys(GOVERNANCE_PILLARS).length, 10)
for (const id of Object.keys(GOVERNANCE_PILLARS)) assert.ok(GOVERNANCE_CRITERIA.some((c) => c.pillarId === id), id)
assert.equal(new Set(GOVERNANCE_CRITERIA.map((c) => c.id)).size, GOVERNANCE_CRITERIA.length)
for (const c of GOVERNANCE_CRITERIA) {
  assert.ok(c.recommendedAction && c.evidenceRequirements.length && c.sourceReferences.length, c.id)
  for (const r of c.sourceReferences) assert.equal(r.verifiedDate, '', `${c.id} references must stay unverified until checked`)
}
const CORE = activeCriteria()
assert.equal(CORE.length, 30)
assert.equal(activeCriteria({ innovationSupport: true }).length, 34)
assert.equal(METHODOLOGY.isProvisional, false)
assert.equal(METHODOLOGY.version, 'CRAFT-GS 1.0')
assert.equal(criterionById('LDR-1')?.pillarId, 'leadership')

const all = (score: number, evidence = true): CriterionResponse[] => CORE.map((c) => ({ criterionId: c.id, score, evidence, notApplicable: false }))

// Nothing answered: no score, nothing silently compliant.
const empty = craftScorecard([])
assert.equal(empty.overall, null)
assert.equal(empty.complete, false)
assert.equal(empty.missingResponses.length, CORE.length)

// Fully evidenced 5s score 100 and Exemplary; fully evidenced 3s score 60.
assert.equal(craftScorecard(all(5)).overall, 100)
assert.equal(craftScorecard(all(5)).rating?.level, 'Exemplary')
assert.equal(craftScorecard(all(3)).overall, 60)
assert.ok(craftScorecard(all(5)).complete)

// Paper compliance: unevidenced 5s are capped at 2 (40%) and flagged, with recommendations.
const paper = craftScorecard(all(5, false))
assert.equal(paper.overall, 40)
assert.equal(paper.unevidenced.length, CORE.length)
assert.equal(paper.recommendations.length, CORE.length)

// Not applicable needs no score and is excluded; unanswered is reported, not scored.
const mixed = all(4).map((r) => (r.criterionId === 'FIN-3' ? { ...r, score: null, notApplicable: true } : r.criterionId === 'OPS-1' ? { ...r, score: null } : r))
const m = craftScorecard(mixed)
assert.deepEqual(m.notApplicable, ['FIN-3'])
assert.deepEqual(m.missingResponses, ['OPS-1'])
assert.equal(m.complete, false)
assert.equal(m.pillars.find((p) => p.id === 'financial')?.applicable, 2)

// Renormalisation: one answered pillar alone gives that pillar's score.
const one = craftScorecard(CORE.filter((c) => c.pillarId === 'ethics').map((c) => ({ criterionId: c.id, score: 4, evidence: true, notApplicable: false })))
assert.equal(one.overall, 80)
assert.equal(one.pillars.filter((p) => p.score != null).length, 1)

// Invalid inputs block the score instead of producing one.
const bad = craftScorecard(all(9))
assert.equal(bad.overall, null)
assert.ok(bad.errors.length)
assert.equal(craftScorecard(all(3), { ...DEFAULT_PILLAR_WEIGHTS, leadership: 50 }).overall, null)

// Lowest scores come first in recommendations.
const low = craftScorecard(all(2).map((r) => (r.criterionId === 'RSK-1' ? { ...r, score: 1 } : r)))
assert.equal(low.recommendations[0].criterionId, 'RSK-1')
assert.equal(low.recommendations[0].priority, 'high')

// Innovation-support overlay: ignored unless enabled; when enabled, unanswered founder safeguards are reported.
const founders = GOVERNANCE_CRITERIA.filter((c) => c.appliesTo === 'innovation_support').map((c) => c.id).sort()
assert.deepEqual(founders, ['ACC-4', 'DAT-4', 'ETH-4', 'RSK-4'])
assert.ok(!craftScorecard(all(5)).missingResponses.some((id) => founders.includes(id)))
const inno = craftScorecard(all(5), DEFAULT_PILLAR_WEIGHTS, { innovationSupport: true })
assert.deepEqual([...inno.missingResponses].sort(), founders)
assert.equal(inno.complete, false)
const innoDone = craftScorecard([...all(5), ...founders.map((id) => ({ criterionId: id, score: 1, evidence: true, notApplicable: false }))], DEFAULT_PILLAR_WEIGHTS, { innovationSupport: true })
assert.ok(innoDone.overall! < 100 && innoDone.recommendations.some((r) => r.criterionId === 'ETH-4' && r.priority === 'high'))

// Independent validation: re-scores replace self scores; the delta is like for like.
const selfAll = all(5)
const noChange = validationDelta(selfAll, {})
assert.equal(noChange.delta, 0)
const down = validationDelta(selfAll, { 'LDR-1': { score: 2, evidence: true, comment: 'No charter review on file' }, 'RSK-1': { score: 3, evidence: false } })
assert.ok(down.delta! < 0)
assert.equal(down.selfOverall, 100)
assert.deepEqual(down.adjustments.map((a) => [a.criterionId, a.selfScore, a.validatorScore]), [['LDR-1', 5, 2], ['RSK-1', 5, 3]])
// An unevidenced validator re-score is capped too.
assert.ok(validationDelta(selfAll, { 'RSK-1': { score: 5, evidence: false } }).delta! < 0)

console.log('craft-governance.test.ts: all assertions passed')
