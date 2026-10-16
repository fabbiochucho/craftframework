// Self-check — run directly with `node src/lib/validity.test.ts`.
import assert from 'node:assert/strict'
import {
  addMonths, addWorkingDays, bringForward, chooseValidity, clampPoint, computeExpiry, decideEvent, deriveStatus, materialEvent, MATERIAL_EVENTS,
  mayMove, milestoneMet, planCheckpoints, progressSentence, reminderDue, reportedLate, reportingDeadline, shortenedExpiry, surveillanceDue,
  verificationIdFrom, VERIFICATION_ID_PATTERN, type ActionLite, type CheckpointLite,
} from './validity.ts'

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const iso = (x: Date) => x.toISOString().slice(0, 10)

// --- validity periods ----------------------------------------------------------
const std = (outcome: any, extra: object = {}) => chooseValidity({ outcome, rung: 3, ...extra })
assert.equal(std('validated').plan?.months, 12, 'validated = 12 months')
assert.equal(std('validated_with_qualifications').plan?.months, 6, 'with qualifications = 6 months')
assert.equal(std('not_validated').plan?.months, 0, 'not validated carries no validity')
assert.ok(std('not_validated', { requestedMonths: 12 }).problem)
// 24 months: rung 5+, no qualifications only.
assert.equal(chooseValidity({ outcome: 'validated', rung: 5, requestedMonths: 24 }).plan?.surveillance, true)
assert.equal(chooseValidity({ outcome: 'validated', rung: 7, requestedMonths: 24 }).plan?.months, 24)
assert.ok(chooseValidity({ outcome: 'validated', rung: 4, requestedMonths: 24 }).problem, 'rung 4 cannot choose 24')
assert.ok(chooseValidity({ outcome: 'validated_with_qualifications', rung: 6, requestedMonths: 24 }).problem, 'qualified cannot choose 24')
assert.ok(chooseValidity({ outcome: 'validated', rung: 6, requestedMonths: 18 }).problem, 'no in-between periods')
assert.ok(chooseValidity({ outcome: 'validated', rung: 6, requestedMonths: 13 }).problem)
assert.ok(chooseValidity({ outcome: 'validated_with_qualifications', rung: 6, requestedMonths: 12 }).problem, 'qualified cannot be lengthened to 12')
assert.equal(chooseValidity({ outcome: 'validated', rung: 3, requestedMonths: 12 }).plan?.choice, 'standard')
// Shorter for a named risk only.
assert.ok(chooseValidity({ outcome: 'validated', rung: 6, requestedMonths: 9 }).problem, 'shorter needs a named risk')
const short = chooseValidity({ outcome: 'validated', rung: 6, requestedMonths: 9, reason: 'Pending audit result' })
assert.equal(short.plan?.months, 9)
assert.equal(short.plan?.choice, 'shorter')
assert.ok(chooseValidity({ outcome: 'validated_with_qualifications', rung: 2, requestedMonths: 3, reason: 'Cash position' }).plan)
assert.ok(chooseValidity({ outcome: 'validated', rung: 2, requestedMonths: 0, reason: 'x' }).problem)
assert.ok(chooseValidity({ outcome: 'validated', rung: 2, requestedMonths: 1.5, reason: 'x' }).problem)

// Calendar maths: end-of-month clamp, leap years.
assert.equal(iso(addMonths(d('2026-01-31'), 1)), '2026-02-28')
assert.equal(iso(addMonths(d('2028-01-31'), 1)), '2028-02-29')
assert.equal(iso(addMonths(d('2026-10-16'), 12)), '2027-10-16')
assert.equal(iso(computeExpiry(d('2026-10-16'), { months: 6 })), '2027-04-16')
assert.equal(iso(surveillanceDue(d('2026-10-16'))), '2027-10-16')

// --- CIP can never extend validity ------------------------------------------------
const issued = d('2026-01-10')
const plan12 = chooseValidity({ outcome: 'validated_with_qualifications', rung: 3 }).plan!
const expiry = computeExpiry(issued, plan12)
const lateActions: ActionLite[] = [{ dueDate: '2030-12-31', done: false, indicatorIds: ['A'] }, { dueDate: '2031-06-30', done: false, indicatorIds: ['B'] }]
for (const kind of ['milestone', 'fixed_3', 'fixed_6', 'end_of_plan'] as const) {
  const pts = planCheckpoints({ issuedAt: issued, expiresAt: expiry, months: plan12.months, surveillance: false, kind, actions: lateActions, scope: ['A', 'B'] })
  assert.ok(pts.length >= 0)
  for (const p of pts) assert.ok(p.dueAt.getTime() < expiry.getTime(), `${kind}: a check never falls on or after expiry, even with CIP dates years away`)
}
// Expiry takes no CIP input at all: identical however the plan goes.
assert.equal(computeExpiry(issued, plan12).getTime(), expiry.getTime())
// A milestone met brings the check forward; it is never pushed later.
const lateDue = d('2026-06-20')
const now = d('2026-03-01')
assert.equal(iso(bringForward(lateDue, now, true)), '2026-03-15')
assert.equal(bringForward(lateDue, now, false).getTime(), lateDue.getTime(), 'milestone not met: unchanged')
const alreadySoon = d('2026-03-05')
assert.equal(bringForward(alreadySoon, now, true).getTime(), alreadySoon.getTime(), 'bring forward never moves a date later')
// The only later-moving operations on expiry are refused.
assert.equal(shortenedExpiry(expiry, new Date(expiry.getTime() + 86_400_000)), null, 'cannot lengthen')
assert.equal(shortenedExpiry(expiry, expiry), null, 'equal is not a shortening')
assert.equal(iso(shortenedExpiry(expiry, d('2026-05-01'))!), '2026-05-01')
// Marking every action done does not change the status or expiry of an already-expired validation either.
assert.equal(deriveStatus({ status: 'expired', now: d('2027-12-01'), expiresAt: expiry, checkpoints: [] }).status, 'expired')

// --- checkpoint planning ------------------------------------------------------------
const acts: ActionLite[] = [
  { dueDate: '2026-03-31', done: false, indicatorIds: ['Q1'] }, { dueDate: '2026-05-15', done: false, indicatorIds: ['Q2'] }, { dueDate: '2026-02-01', done: false, indicatorIds: ['other'] },
]
const y12 = d('2027-01-10')
const ms = planCheckpoints({ issuedAt: issued, expiresAt: y12, months: 12, surveillance: false, kind: 'milestone', actions: acts, scope: ['Q1', 'Q2'] })
assert.equal(ms.length, 1)
assert.equal(iso(ms[0].dueAt), '2026-05-15', 'milestone = latest qualified/blocking action; unrelated actions are ignored')
const eop = planCheckpoints({ issuedAt: issued, expiresAt: y12, months: 12, surveillance: false, kind: 'end_of_plan', actions: [...acts, { dueDate: '2026-08-01', done: false, indicatorIds: ['other'] }], scope: ['Q1'] })
assert.equal(iso(eop[0].dueAt), '2026-08-01', 'end of plan = latest of ALL actions')
assert.equal(iso(planCheckpoints({ issuedAt: issued, expiresAt: y12, months: 12, surveillance: false, kind: 'milestone', actions: [], scope: [] })[0].dueAt), '2026-07-10', 'no actions: mid-validity')
const f3 = planCheckpoints({ issuedAt: issued, expiresAt: y12, months: 12, surveillance: false, kind: 'fixed_3', actions: [], scope: [] })
assert.deepEqual(f3.map((p) => iso(p.dueAt)), ['2026-04-10', '2026-07-10', '2026-10-10'], 'every 3 months, none at expiry')
const f6 = planCheckpoints({ issuedAt: issued, expiresAt: y12, months: 12, surveillance: false, kind: 'fixed_6', actions: [], scope: [] })
assert.deepEqual(f6.map((p) => iso(p.dueAt)), ['2026-07-10'])
assert.equal(planCheckpoints({ issuedAt: issued, expiresAt: addMonths(issued, 6), months: 6, surveillance: false, kind: 'fixed_6', actions: [], scope: [] }).length, 0, 'a 6-month validity has no room for a 6-month interval')
const ext = planCheckpoints({ issuedAt: issued, expiresAt: addMonths(issued, 24), months: 24, surveillance: true, kind: 'milestone', actions: [], scope: [] })
assert.deepEqual(ext.map((p) => p.kind), ['surveillance', 'follow_up'])
assert.equal(iso(ext[0].dueAt), '2027-01-10', 'surveillance at month 12')
assert.equal(iso(clampPoint(d('2040-01-01'), issued, y12)), '2026-12-27', 'clamped 14 days before expiry')
assert.equal(iso(clampPoint(d('2020-01-01'), issued, y12)), '2026-01-10', 'never before issue')
assert.equal(milestoneMet('milestone', [{ dueDate: null, done: true, indicatorIds: ['Q1'] }, { dueDate: null, done: false, indicatorIds: ['x'] }], ['Q1']), true)
assert.equal(milestoneMet('milestone', [{ dueDate: null, done: false, indicatorIds: ['Q1'] }], ['Q1']), false)
assert.equal(milestoneMet('milestone', [], ['Q1']), false, 'nothing to wait for is not a met milestone')
assert.equal(milestoneMet('end_of_plan', [{ dueDate: null, done: true, indicatorIds: [] }, { dueDate: null, done: false, indicatorIds: [] }], []), false)
assert.equal(milestoneMet('fixed_3', [{ dueDate: null, done: true, indicatorIds: [] }], []), false, 'fixed schedules are not brought forward')
assert.equal(progressSentence(2, 5, d('2026-03-15')), '2 of 5 actions done, follow-up due 15 March')
assert.equal(progressSentence(1, 1, null), '1 of 1 action done')

// --- status transitions ---------------------------------------------------------------
const cp = (kind: any, due: string, state: any = 'pending'): CheckpointLite => ({ kind, dueAt: d(due), state })
const st = (status: any, today: string, checkpoints: CheckpointLite[] = [], exp: string | null = '2027-01-10') =>
  deriveStatus({ status, now: d(today), expiresAt: exp ? d(exp) : null, checkpoints })
assert.equal(st('current', '2026-06-01').status, 'current')
assert.equal(st('current', '2026-06-01', [cp('follow_up', '2026-07-01')]).status, 'current', 'a future point is not overdue')
assert.equal(st('current', '2026-07-02', [cp('follow_up', '2026-07-01')]).status, 'follow_up_overdue', 'missed point -> follow-up overdue')
assert.equal(st('current', '2026-07-01', [cp('follow_up', '2026-07-01')]).status, 'current', 'due today is not yet overdue')
assert.equal(st('follow_up_overdue', '2026-07-09', [cp('follow_up', '2026-07-01', 'done')]).status, 'current', 'completing it returns to current')
assert.equal(st('follow_up_overdue', '2026-07-09', [cp('follow_up', '2026-07-01')]).status, 'follow_up_overdue')
assert.equal(st('current', '2027-01-10').status, 'expired', 'at expiry -> expired')
assert.equal(st('follow_up_overdue', '2027-02-01', [cp('follow_up', '2026-07-01')]).status, 'expired', 'expired, not follow-up overdue, once past expiry')
assert.equal(st('suspended', '2026-08-01', [cp('follow_up', '2026-07-01')]).status, 'suspended', 'suspension holds')
assert.equal(st('suspended', '2027-01-11').status, 'expired', 'a suspension never carries a validation past expiry')
for (const final of ['withdrawn', 'superseded', 'expired'] as const) assert.equal(st(final, '2026-06-01').status, final, `${final} is final`)
assert.equal(st('current', '2030-01-01', [], null).status, 'current', 'not-validated records carry no expiry')
// 24 months: missed month-12 surveillance expires the validation at month 12.
const long = deriveStatus({ status: 'current', now: d('2027-02-01'), expiresAt: d('2028-01-10'), checkpoints: [cp('surveillance', '2027-01-10')] })
assert.equal(long.status, 'expired')
assert.equal(iso(long.expiresAt!), '2027-01-10', 'expires at 12, not 24')
assert.match(long.reason, /surveillance/)
assert.equal(deriveStatus({ status: 'current', now: d('2027-02-01'), expiresAt: d('2028-01-10'), checkpoints: [cp('surveillance', '2027-01-10', 'done')] }).status, 'current', 'a done surveillance check keeps the 24 months')
assert.equal(deriveStatus({ status: 'current', now: d('2026-12-01'), expiresAt: d('2028-01-10'), checkpoints: [cp('surveillance', '2027-01-10')] }).status, 'current')

// Manual moves.
assert.equal(mayMove('current', 'suspended'), true)
assert.equal(mayMove('follow_up_overdue', 'suspended'), true)
assert.equal(mayMove('suspended', 'current'), true, 'reinstate')
assert.equal(mayMove('suspended', 'withdrawn'), true)
assert.equal(mayMove('current', 'withdrawn'), true)
assert.equal(mayMove('withdrawn', 'current'), false, 'withdrawn is final')
assert.equal(mayMove('expired', 'current'), false, 'an expired validation cannot be revived')
assert.equal(mayMove('superseded', 'suspended'), false)
assert.equal(mayMove('current', 'follow_up_overdue'), false, 'overdue is derived from dates, never set by hand')

// --- reminders --------------------------------------------------------------------------
const due = d('2026-09-01')
assert.equal(reminderDue(due, d('2026-07-01'), []), null, 'more than 30 days out')
assert.equal(reminderDue(due, d('2026-08-02'), []), 30, '30 days out')
assert.equal(reminderDue(due, d('2026-08-02'), [30]), null, 'not sent twice')
assert.equal(reminderDue(due, d('2026-08-10'), [30]), null, 'between thresholds')
assert.equal(reminderDue(due, d('2026-08-25'), [30]), 7, '7 days out')
assert.equal(reminderDue(due, d('2026-08-25'), []), 7, 'a missed day sends only the tightest reminder, not both')
assert.equal(reminderDue(due, d('2026-08-25'), [7]), null)
assert.equal(reminderDue(due, d('2026-09-01'), []), null, 'nothing once the point has arrived')
assert.equal(reminderDue(due, d('2026-09-05'), []), null, 'nothing after the point')

// --- material events -----------------------------------------------------------------------
assert.equal(MATERIAL_EVENTS.length, 13)
assert.deepEqual(MATERIAL_EVENTS.filter((e) => e.starred).map((e) => e.key), ['fraud_corruption', 'criminal_investigation', 'regulator_sanction', 'safeguarding_data'])
assert.equal(materialEvent('nope'), null)
// 30 calendar days for ordinary events.
assert.equal(iso(reportingDeadline('leadership_change', d('2026-10-01'))!), '2026-10-31')
// 5 WORKING days for starred events: Friday -> next Friday; a weekend start counts from Monday.
assert.equal(iso(reportingDeadline('fraud_corruption', d('2026-10-16'))!), '2026-10-23', 'Fri 16 Oct + 5 working days = Fri 23 Oct')
assert.equal(iso(reportingDeadline('fraud_corruption', d('2026-10-17'))!), '2026-10-23', 'Sat 17 Oct: Mon..Fri = 23 Oct')
assert.equal(iso(addWorkingDays(d('2026-10-12'), 5)), '2026-10-19', 'Mon + 5 working days = next Mon')
assert.equal(reportingDeadline('nope', d('2026-10-01')), null)
assert.equal(reportedLate('leadership_change', d('2026-10-01'), d('2026-10-31')), false, 'on the deadline day is on time')
assert.equal(reportedLate('leadership_change', d('2026-10-01'), d('2026-11-01')), true)
assert.equal(reportedLate('regulator_sanction', d('2026-10-12'), d('2026-10-19')), false)
assert.equal(reportedLate('regulator_sanction', d('2026-10-12'), d('2026-10-20')), true, 'starred events are late after 5 working days, not 30 days')
// Validator decisions.
assert.deepEqual(decideEvent('reinstate', 0), { eventStatus: 'reinstated', keepSuspended: false, withdraw: false })
assert.deepEqual(decideEvent('rescope', 0), { eventStatus: 're_scoped', keepSuspended: false, withdraw: false })
assert.equal(decideEvent('reinstate', 1).keepSuspended, true, 'other open events keep it suspended')
assert.deepEqual(decideEvent('withdraw', 3), { eventStatus: 'withdrawn', keepSuspended: false, withdraw: true })

// --- verification ids -------------------------------------------------------------------------
assert.match(verificationIdFrom(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])), VERIFICATION_ID_PATTERN)
assert.equal(verificationIdFrom(new Uint8Array(8)), 'CRAFT-V-AAAAAAAA')
assert.equal(verificationIdFrom(new Uint8Array(8).fill(255)), 'CRAFT-V-99999999')
assert.throws(() => verificationIdFrom(new Uint8Array(3)))
assert.ok(!VERIFICATION_ID_PATTERN.test('CRAFT-V-0O1IAAAA'), 'ambiguous characters are never issued')
assert.notEqual(verificationIdFrom(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), verificationIdFrom(new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1])))

console.log('validity.test.ts ok')
