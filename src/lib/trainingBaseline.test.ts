// Self-check: `node src/lib/trainingBaseline.test.ts` — pre- and post-tests for the explainer videos.
// The real bank is private (craft-internal/training/baselineBank.ts checks its own shape); this uses a synthetic one.
import assert from 'node:assert/strict'
import { askQuestions, learnerView, scoreAttempt, summarise, type AttemptRow, type BaselineBank, type BaselineQuestion } from './trainingBaseline.ts'

const q = (id: string, correct: number): BaselineQuestion => ({ id, prompt: `Question ${id}`, options: ['a', 'b', 'c', 'd'], correct, explanation: `Why ${id}` })
const bank: BaselineBank = {
  m1: { pre: [q('p1', 1), q('p2', 1), q('p3', 1)], postExtra: [q('x1', 1), q('x2', 1)] },
  m2: { pre: [q('p1', 3), q('p2', 2), q('p3', 1)], postExtra: [q('x1', 0), q('x2', 0)] },
}
const MODULES = Object.keys(bank)

// The post-test repeats the pre-test and adds two more
assert.equal(askQuestions(bank, 'm1', 'pre')!.length, 3)
assert.deepEqual(askQuestions(bank, 'm1', 'post')!.map((x) => x.id), ['p1', 'p2', 'p3', 'x1', 'x2'])
// The questions sent before answering carry no answer or explanation
assert.ok(askQuestions(bank, 'm1', 'post')!.every((x) => !('correct' in x) && !('explanation' in x)))
assert.equal(askQuestions(bank, 'm99', 'pre'), null)
assert.equal(askQuestions(bank, 'toString', 'pre'), null, 'inherited keys are not modules')

// Scoring is server-side and strict about the answer list
const right = scoreAttempt(bank, 'm2', 'pre', [3, 2, 1])!
assert.equal(right.score, 3); assert.equal(right.total, 3)
assert.ok(right.results.every((r) => r.ok && r.explanation.length > 0))
assert.equal(scoreAttempt(bank, 'm2', 'pre', [0, 0, 0])!.score, 0)
assert.equal(scoreAttempt(bank, 'm2', 'pre', [1, 1]), null, 'too few answers')
assert.equal(scoreAttempt(bank, 'm2', 'pre', [1, 1, 9]), null, 'answer out of range')
assert.equal(scoreAttempt(bank, 'm2', 'pre', [1, 1, 1.5]), null, 'not an integer')
assert.equal(scoreAttempt(bank, 'nope', 'pre', [0, 0, 0]), null)
assert.equal(scoreAttempt(bank, 'm2', 'post', [0, 0, 0, 0, 0])!.total, 5)

// A learner sees their own first pre-test and latest post-test per module
const at = (d: string) => new Date(`2026-10-${d}T10:00:00Z`)
const rows: AttemptRow[] = [
  { email: 'a@x', moduleId: 'm1', kind: 'pre', score: 1, total: 3, createdAt: at('01') },
  { email: 'a@x', moduleId: 'm1', kind: 'post', score: 3, total: 5, createdAt: at('02') },
  { email: 'a@x', moduleId: 'm1', kind: 'post', score: 5, total: 5, createdAt: at('03') },
  { email: 'b@x', moduleId: 'm1', kind: 'pre', score: 3, total: 3, createdAt: at('01') },
  { email: 'b@x', moduleId: 'm1', kind: 'post', score: 4, total: 5, createdAt: at('02') },
  { email: 'c@x', moduleId: 'm1', kind: 'pre', score: 0, total: 3, createdAt: at('01') },
]
const mine = learnerView(MODULES, rows.filter((r) => r.email === 'a@x'))
assert.equal(mine.m1.pre!.score, 1)
assert.equal(mine.m1.post!.score, 5, 'latest post-test counts')

// Programme team: per module averages (as % correct) and the change for learners with both tests
const s = summarise(MODULES, rows).find((x) => x.moduleId === 'm1')!
assert.equal(s.pre.n, 3); assert.equal(s.pre.meanPct, Math.round(((1 / 3) + 1 + 0) / 3 * 100))
assert.equal(s.post.n, 2); assert.equal(s.post.meanPct, Math.round((1 + 0.8) / 2 * 100))
assert.equal(s.paired.n, 2)
assert.equal(s.paired.changePct, Math.round(((1 - 1 / 3) + (0.8 - 1)) / 2 * 100))
assert.equal(summarise(MODULES, rows).find((x) => x.moduleId === 'm2')!.pre.n, 0)

console.log('training baseline: ok')
