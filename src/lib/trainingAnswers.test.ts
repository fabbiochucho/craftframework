// Self-check: `node src/lib/trainingAnswers.test.ts` — the training answer key is kept out of the public repo.
import assert from 'node:assert/strict'
import { splitAnswers, mergeAnswers, fingerprint, withAnswers, syntheticAnswerKey } from './trainingAnswers.ts'
import { OPEN_TRAINING_CONTENT } from './trainingContent.ts'

const full = {
  modules: [{ id: 'm1', exercises: [{ type: 'classify', items: [{ prompt: 'p', options: ['a', 'b'], correct: 1, explain: 'b because' }] }],
    scenario: { prompt: 's', choices: [{ text: 'x', consequence: 'c', feedback: 'f', best: false }, { text: 'y', consequence: 'c2', feedback: 'f2', best: true }] } }],
  questions: [{ id: 'q1', prompt: 'Q?', options: ['a', 'b'], correctIndex: 0, explanation: 'a' }],
  capstone: { id: 'r', brief: 'b', referenceScores: { A: 4 }, modelAnswer: 'm' },
}
const { open, key } = splitAnswers(full)
const text = JSON.stringify(open)
for (const f of ['correct', 'explain', 'consequence', 'feedback', 'best', 'correctIndex', 'explanation', 'referenceScores', 'modelAnswer']) {
  assert.ok(!text.includes(`"${f}"`), `${f} is not in the public content`)
}
assert.ok(text.includes('"prompt"') && text.includes('"options"'), 'questions stay public')
assert.deepEqual(mergeAnswers(open, key), full, 'merging the key restores the full content')

// The key only applies to the content it was made from
const k = { fingerprint: fingerprint(open), answers: key }
assert.deepEqual(withAnswers(open, k), full)
assert.throws(() => withAnswers({ ...(open as object), extra: 1 }, k), /does not match/)

// The real public content carries no answers, and a synthetic key (for tests) fills every answer slot
const real = JSON.stringify(OPEN_TRAINING_CONTENT)
assert.ok(!/"(correct|correctIndex|explanation|modelAnswer|referenceScores?|best|consequence|feedback|explain|model)"/.test(real), 'no answers in trainingContent.ts')
const synthetic = withAnswers(OPEN_TRAINING_CONTENT, syntheticAnswerKey(OPEN_TRAINING_CONTENT))
assert.ok(synthetic.questions.every((q) => q.correctIndex >= 0 && q.correctIndex < q.options.length))
assert.ok(synthetic.modules.every((m) => m.scenario.choices.filter((c) => c.best).length === 1))
assert.ok(synthetic.calibration.every((c) => Number.isInteger(c.referenceScore)))

console.log('trainingAnswers: ok')
