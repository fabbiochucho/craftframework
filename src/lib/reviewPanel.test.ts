// Self-check — run directly with `node src/lib/reviewPanel.test.ts`.
import assert from 'node:assert/strict'
import {
  appealDeadline, appealOpen, caseClock, conflictReasons, decisionKey, decisionLabel, decisionProblems, isDismissal, isOverdue, majority, mayDeliberate, panelSeated, seatsFree,
  type ConflictFacts, type Decision,
} from './reviewPanel.ts'

const none: Decision = { validation: 'none', validator: 'none', feedback: 'none' }

// Dismissal: nothing is acted on.
assert.ok(isDismissal(none))
assert.ok(isDismissal({ ...none, validation: 'stands' }))
assert.ok(isDismissal({ validation: 'none', validator: 'none', feedback: 'keep' }))
assert.ok(!isDismissal({ ...none, validation: 'suspended' }))
assert.ok(!isDismissal({ ...none, validator: 'warned' }))
assert.ok(!isDismissal({ ...none, feedback: 'remove', feedbackGround: 'abusive' }))
assert.equal(decisionLabel({ ...none, validation: 'stands' }), 'Dismissed — the validation stands')
assert.match(decisionLabel({ validation: 'withdrawn', validator: 'warned', feedback: 'none' }), /withdrawn.*warned/)

// Each kind can only decide its own parts.
assert.deepEqual(decisionProblems('validation_dispute', { ...none, validation: 'amended', validator: 'retrain' }), [])
assert.equal(decisionProblems('validation_dispute', { ...none, feedback: 'remove', feedbackGround: 'false' }).length, 1)
assert.equal(decisionProblems('validator_complaint', { ...none, validation: 'amended' }).length, 1)
assert.deepEqual(decisionProblems('validator_complaint', { ...none, validator: 'suspended' }), [])
assert.deepEqual(decisionProblems('feedback_complaint', { ...none, feedback: 'keep' }), [])
assert.deepEqual(decisionProblems('feedback_complaint', { ...none, feedback: 'remove', feedbackGround: 'abusive' }), [])
assert.equal(decisionProblems('feedback_complaint', { ...none, feedback: 'remove' }).length, 1, 'a removal needs a ground')
assert.equal(decisionProblems('feedback_complaint', none).length, 1, 'must keep or remove')
assert.equal(decisionProblems('feedback_complaint', { ...none, validator: 'removed', feedback: 'keep' }).length, 1)
assert.equal(decisionProblems('contested_event', { validation: 'nonsense' as never, validator: 'none', feedback: 'none' }).length, 1)

// Majority: 2 of 3; three different answers have none; changing a vote can create one.
const a: Decision = { ...none, validation: 'suspended' }
const b: Decision = { ...none, validation: 'withdrawn' }
assert.equal(majority([a, a, b]), a)
assert.equal(majority([a, b, a]), a)
assert.equal(majority([a, a, a]), a)
assert.equal(majority([a, b, none]), null)
assert.equal(majority([a, b]), null, 'two different votes: no majority')
assert.equal(majority([a]), null)
assert.equal(majority([]), null)
assert.notEqual(decisionKey({ ...none, feedback: 'remove', feedbackGround: 'false' }), decisionKey({ ...none, feedback: 'remove', feedbackGround: 'abusive' }))
assert.equal(majority([{ ...none, feedback: 'remove', feedbackGround: 'false' }, { ...none, feedback: 'remove', feedbackGround: 'abusive' }, { ...none, feedback: 'keep' }]), null)

// Clocks: 14 days to respond, 30 to decide, 14 to appeal.
const t0 = new Date('2026-03-01T10:00:00Z')
assert.deepEqual(caseClock(t0), { respondBy: '2026-03-15', decideBy: '2026-03-31' })
assert.equal(appealDeadline(t0), '2026-03-15')
assert.ok(!isOverdue({ status: 'deliberating', decideBy: '2026-03-31' }, new Date('2026-03-31T23:00:00Z')))
assert.ok(isOverdue({ status: 'deliberating', decideBy: '2026-03-31' }, new Date('2026-04-01T00:00:00Z')))
assert.ok(!isOverdue({ status: 'decided', decideBy: '2026-03-31' }, new Date('2026-06-01')))
assert.ok(!isOverdue({ status: 'open', decideBy: null }))
const decided = { status: 'decided', appealBy: '2026-03-15', hasAppeal: false, isAppeal: false }
assert.ok(appealOpen(decided, new Date('2026-03-15T12:00:00Z')))
assert.ok(!appealOpen(decided, new Date('2026-03-16T00:00:00Z')))
assert.ok(!appealOpen({ ...decided, hasAppeal: true }, new Date('2026-03-10')), 'one appeal only')
assert.ok(!appealOpen({ ...decided, isAppeal: true }, new Date('2026-03-10')), 'an appeal cannot be appealed')
assert.ok(!appealOpen({ ...decided, status: 'deliberating' }, new Date('2026-03-10')))
assert.ok(mayDeliberate({ status: 'responses', respondBy: '2026-03-15', sidesHeard: 2 }, new Date('2026-03-02')))
assert.ok(!mayDeliberate({ status: 'responses', respondBy: '2026-03-15', sidesHeard: 1 }, new Date('2026-03-02')))
assert.ok(mayDeliberate({ status: 'responses', respondBy: '2026-03-15', sidesHeard: 0 }, new Date('2026-03-16')))
assert.ok(!mayDeliberate({ status: 'open', respondBy: null, sidesHeard: 2 }))

// Conflict checks.
const clean: ConflictFacts = { reviewer: 'r@x', isPlatformAdmin: false, parties: ['v@y', 'o@z'], reviewerFirmIds: ['f1'], partyFirmIds: ['f2'], workedWithPartyRecently: false, earlierPanelMembers: [] }
assert.deepEqual(conflictReasons(clean), [])
assert.equal(conflictReasons({ ...clean, isPlatformAdmin: true }).length, 1)
assert.equal(conflictReasons({ ...clean, parties: ['R@X'] }).length, 1, 'case-insensitive')
assert.equal(conflictReasons({ ...clean, reviewerFirmIds: ['f2', 'f1'] }).length, 1, 'same firm as the validator')
assert.equal(conflictReasons({ ...clean, workedWithPartyRecently: true }).length, 1)
assert.equal(conflictReasons({ ...clean, earlierPanelMembers: ['r@x'] }).length, 1, 'appeal panels are fresh')
assert.equal(conflictReasons({ ...clean, isPlatformAdmin: true, workedWithPartyRecently: true }).length, 2)

// Seating: one convenor, two reviewers, all accepted; a declined seat is free again.
const m = (role: string, status: string) => ({ role, status })
assert.ok(panelSeated([m('convenor', 'accepted'), m('reviewer', 'accepted'), m('reviewer', 'accepted')]))
assert.ok(!panelSeated([m('convenor', 'accepted'), m('reviewer', 'accepted'), m('reviewer', 'invited')]))
assert.ok(!panelSeated([m('convenor', 'accepted'), m('reviewer', 'accepted')]))
assert.ok(!panelSeated([m('reviewer', 'accepted'), m('reviewer', 'accepted'), m('reviewer', 'accepted')]))
assert.equal(seatsFree([], 'convenor'), 1)
assert.equal(seatsFree([], 'reviewer'), 2)
assert.equal(seatsFree([m('reviewer', 'invited'), m('reviewer', 'declined')], 'reviewer'), 1)
assert.equal(seatsFree([m('reviewer', 'accepted'), m('reviewer', 'invited')], 'reviewer'), 0)
assert.equal(seatsFree([m('convenor', 'declined')], 'convenor'), 1)

console.log('reviewPanel: ok')
