// Self-check — run directly with `node src/lib/controlChecks.test.ts`.
import assert from 'node:assert/strict'
import { isComplete, scoreCap, scoreProblem, type ControlChecks } from './controlChecks.ts'

const all = (v: 'yes' | 'no' | 'not_tested'): ControlChecks =>
  ({ design: v, authorisation: v, systemSupport: v, operating: v, traceability: v, adequacy: v, sustainability: v })
const yes = all('yes')

assert.equal(scoreCap(yes).max, 5)
assert.equal(scoreCap({ ...yes, systemSupport: 'no' }).max, 5, 'manual controls are noted, not capped')
assert.deepEqual(scoreCap({ ...yes, design: 'no' }), { max: 1, reasons: ['not designed'] })
assert.equal(scoreCap({ ...yes, authorisation: 'no' }).max, 2)
assert.deepEqual(scoreCap({ ...yes, operating: 'not_tested' }), { max: 3, reasons: ['not tested in practice'] })
assert.equal(scoreCap({ ...yes, traceability: 'no' }).max, 3)
assert.equal(scoreCap({ ...yes, adequacy: 'no' }).max, 3)
assert.deepEqual(scoreCap({ ...yes, sustainability: 'no' }), { max: 4, reasons: ['not sustainable without outside support'] })
// The lowest limit wins and only its reasons are given.
assert.deepEqual(scoreCap({ ...yes, design: 'no', operating: 'no' }), { max: 1, reasons: ['not designed'] })
assert.deepEqual(scoreCap({ ...yes, operating: 'no', traceability: 'no' }).reasons, ['does not work in practice', 'not traceable'])
// Not tested counts as not met: a paper-only policy cannot score above 1 if its design was never checked.
assert.equal(scoreCap(all('not_tested')).max, 1)

assert.equal(isComplete(yes), true)
assert.equal(isComplete({ design: 'yes' }), false)
assert.equal(scoreProblem('scored', 4, { design: 'yes' }), 'Record all seven checks before scoring')
assert.equal(scoreProblem('scored', 5, yes), null)
assert.match(scoreProblem('scored', 4, { ...yes, operating: 'not_tested' })!, /at most 3 \(not tested in practice\)/)
assert.equal(scoreProblem('not_evidenced', 0, {}), null, 'not evidenced needs no checks')
assert.match(scoreProblem('not_evidenced', 2, {})!, /recorded as 0/)

console.log('controlChecks.test.ts: all assertions passed')
