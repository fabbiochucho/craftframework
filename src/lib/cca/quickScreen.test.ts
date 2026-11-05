// Self-check — run directly with `node src/lib/cca/quickScreen.test.ts`.
import assert from 'node:assert/strict'
import { outcomeFor, scoreScreen, screenProblems, validAnswer, type QuickScreen } from './quickScreen.ts'

// Half-open bands, no gaps.
assert.deepEqual([0, 0.3499, 0.35, 0.5499, 0.55, 0.8499, 0.85, 1].map(outcomeFor),
  ['not_eligible', 'not_eligible', 'high_risk', 'high_risk', 'substantial_support', 'substantial_support', 'minimal_support', 'minimal_support'])

const screen: QuickScreen = { name: 'Test', sections: [
  { id: 'pol', name: 'Policies', questions: [{ id: 'p1', kind: 'yes_no', text: 'Finance policy' }, { id: 'p2', kind: 'yes_no', text: 'HR policy' }] },
  { id: 'size', name: 'Size', questions: [{ id: 's1', kind: 'choice', text: 'Annual income', options: [{ value: 'a', label: 'Small', points: 1 }, { value: 'b', label: 'Large', points: 3 }] }] },
] }
assert.deepEqual(screenProblems(screen), [])

const r = scoreScreen(screen, { p1: 'yes', p2: 'no', s1: 'b' })
assert.deepEqual([r.score, r.max, r.percent, r.outcome, r.unanswered], [4, 5, 80, 'substantial_support', 0])
assert.deepEqual(r.sections.map((x) => [x.id, x.score, x.max, x.gaps]), [['pol', 1, 2, ['HR policy']], ['size', 3, 3, []]])
assert.deepEqual([scoreScreen(screen, { p1: 'yes', p2: 'yes', s1: 'b' }).outcome, scoreScreen(screen, {}).outcome], ['minimal_support', 'not_eligible'])
assert.equal(scoreScreen(screen, { p1: 'yes' }).unanswered, 2, 'unanswered counts as 0 and is reported')
assert.equal(scoreScreen(screen, { s1: 'zzz' }).score, 0, 'an unknown option scores nothing')

assert.ok(validAnswer(screen.sections[0].questions[0], 'no'))
assert.ok(!validAnswer(screen.sections[0].questions[0], 'maybe'))
assert.ok(validAnswer(screen.sections[1].questions[0], 'a'))
assert.ok(!validAnswer(screen.sections[1].questions[0], 'yes'))

assert.deepEqual(screenProblems(null), ['the screen needs sections'])
const bad = { name: 'x', sections: [{ id: 'a', name: 'A', questions: [{ id: 'q', kind: 'yes_no', text: 'x' }, { id: 'q', kind: 'choice', text: 'y', options: [{ value: 'o', label: 'O', points: 1 }] }] }] }
assert.deepEqual(screenProblems(bad), ['question q: ids must be present and unique', 'q: a choice needs at least two options'])

console.log('cca/quickScreen.test.ts: all assertions passed')
