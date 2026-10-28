// Self-check: `node src/lib/plainSummary.test.ts` — "In plain words" summaries are built from the organisation's own scores.
import assert from 'node:assert/strict'
import { MOCK_QUESTIONS } from './data.ts'
import { LADDER_INDICATORS } from './capitalReadiness.ts'
import { ESG_QUESTIONS } from './esg.ts'
import { coreSummary, esgSummary, indexSummary, ladderSummary } from './plainSummary.ts'

// Nothing answered: no summary, so an empty assessment never reads as a poor result
assert.equal(coreSummary(MOCK_QUESTIONS, {}), null)
assert.equal(ladderSummary({}), null)
assert.equal(esgSummary({}), null)

// Core: the lowest answers (2 or below) become the gaps, and their capacity actions the steps
// the public repo holds sample text only; pages pass the full bank loaded at runtime, so give each question text here
const bank = MOCK_QUESTIONS.slice(0, 4).map((q, i) => ({ ...q, question: `Question ${i + 1}?`, capacityAction: `Action ${i + 1}` }))
const [q1, q2, q3, q4] = bank
const core = coreSummary(bank, { [q1.id]: 0, [q2.id]: 5, [q3.id]: 2, [q4.id]: 1 })!
assert.match(core.standing, /out of 100/)
assert.deepEqual(core.gaps.map((g) => g.text), [q1.question, q4.question, q3.question])
assert.ok(core.steps.length >= 1 && core.steps.length <= 3 && core.steps.includes(q1.capacityAction))
assert.ok(!core.gaps.some((g) => g.text === q2.question), 'a strong answer is never listed as a gap')

// Ladder: nothing reached yet points at Survival and its unanswered questions
const first = LADDER_INDICATORS.find((i) => i.level === 1)!
const ladder = ladderSummary({ [first.id]: 1 })!
assert.match(ladder.standing, /not reached the first rung, Survival/)
assert.match(ladder.steps[0], /Answer the \d+ remaining Survival question/)
assert.deepEqual(ladder.gaps.map((g) => g.text), [first.question])

// Ladder: every level 1 indicator at 4 reaches rung 1 and names the next rung
const l1 = Object.fromEntries(LADDER_INDICATORS.filter((i) => i.level === 1).map((i) => [i.id, 4]))
assert.match(ladderSummary(l1)!.standing, /rung 1 of 7, Survival\. The next rung is Credibility/)

// ESG: pillar averages, weakest pillar and recommendations for answers below 3
const e = ESG_QUESTIONS.find((q) => q.pillar === 'Environmental')!
const g = ESG_QUESTIONS.find((q) => q.pillar === 'Governance')!
const esg = esgSummary({ [e.id]: 1, [g.id]: 4 })!
assert.match(esg.standing, /Environmental 1\.0, Governance 4\.0 out of 5/)
assert.match(esg.standing, /Environmental is your weakest area/)
assert.deepEqual(esg.steps, [e.recommendation])

// Index: band, provisional note and the weakest answers
const idx = indexSummary({ title: 'Resilience', version: null, question: '', band: { band: { min: 0, label: 'Developing', summary: '', tone: 'amber' }, uncapped: { min: 0, label: 'Developing', summary: '', tone: 'amber' }, weakLinks: [], provisional: true } as any,
  composite: 2, answered: 3, total: 10, dimensions: [], weakest: [{ id: 'a', question: 'Is there a reserve?', score: 1 }], lenses: [], feedsPlan: false, actions: [] })!
assert.match(idx.standing, /Your band is Developing, provisional until every question is answered\. You have answered 3 of 10/)
assert.deepEqual(idx.gaps, [{ text: 'Is there a reserve?', area: 'Resilience' }])
assert.equal(indexSummary({ answered: 0 } as any), null)

console.log('plain summary: ok')
