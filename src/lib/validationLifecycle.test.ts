// Self-check — run directly with `node src/lib/validationLifecycle.test.ts`.
import assert from 'node:assert/strict'
import {
  addMonths, addWorkingDays, dueReminders, effectiveExpiry, effectiveStatus, isStarred, issuedValidity, MATERIAL_EVENTS, nextFollowUp,
  reportingDeadline, statusAfterDecision, validityProblems,
} from './validationLifecycle.ts'

const d = (s: string) => new Date(`${s}T00:00:00Z`)
const iso = (x: Date) => x.toISOString().slice(0, 10)

// Months: end-of-month safe.
assert.equal(iso(addMonths(d('2026-01-31'), 1)), '2026-02-28')
assert.equal(iso(addMonths(d('2026-03-15'), 12)), '2027-03-15')
assert.equal(iso(addMonths(d('2024-02-29'), 12)), '2025-02-28')

// Validity: 12 / 6 months, 24 only for rung 5+ without qualifications, shorter always with a named risk.
assert.deepEqual(validityProblems('validated', 3, null), [])
assert.deepEqual(validityProblems('validated', 5, { months: 24, reason: '' }), [])
assert.match(validityProblems('validated', 4, { months: 24, reason: '' })[0], /rung 5\+/)
assert.match(validityProblems('validated', 5, { months: 18, reason: '' })[0], /rung 5\+/, 'only exactly 24')
assert.match(validityProblems('validated_with_qualifications', 6, { months: 12, reason: '' })[0], /at most 6/)
assert.match(validityProblems('validated_with_qualifications', 7, { months: 24, reason: '' })[0], /at most 6/)
assert.match(validityProblems('validated', 3, { months: 9, reason: '' })[0], /Name the risk/)
assert.deepEqual(validityProblems('validated', 3, { months: 9, reason: 'Pending licence renewal' }), [])
assert.deepEqual(validityProblems('validated_with_qualifications', 3, { months: 3, reason: 'Open audit' }), [])
assert.ok(validityProblems('validated', 3, { months: 0, reason: 'x' }).length)
assert.ok(validityProblems('not_validated', 0, { months: 12, reason: '' }).length)

const issued = issuedValidity('validated', d('2026-01-10'))
assert.equal(iso(issued.expiresAt), '2027-01-10')
assert.equal(issued.surveillanceDueAt, null)
assert.equal(iso(issuedValidity('validated_with_qualifications', d('2026-01-10')).expiresAt), '2026-07-10')
const long = issuedValidity('validated', d('2026-01-10'), 24)
assert.equal(iso(long.expiresAt), '2028-01-10')
assert.equal(iso(long.surveillanceDueAt!), '2027-01-10')

// Statuses: decisions stick, the calendar does the rest.
const base = { status: 'current', expiresAt: d('2027-01-10'), surveillanceDueAt: null, surveillanceDoneAt: null } as const
assert.equal(effectiveStatus(base, false, d('2026-06-01')), 'current')
assert.equal(effectiveStatus(base, true, d('2026-06-01')), 'follow_up_overdue')
assert.equal(effectiveStatus(base, true, d('2027-01-10')), 'expired', 'expiry beats overdue; expired is not "not validated"')
for (const s of ['suspended', 'withdrawn', 'superseded'] as const) assert.equal(effectiveStatus({ ...base, status: s }, true, d('2030-01-01')), s)
// 24 months: missing the 12-month surveillance check expires it at 12.
const lng = { status: 'current', expiresAt: d('2028-01-10'), surveillanceDueAt: d('2027-01-10'), surveillanceDoneAt: null } as const
assert.equal(iso(effectiveExpiry(lng)), '2027-01-10')
assert.equal(effectiveStatus(lng, false, d('2027-02-01')), 'expired')
assert.equal(effectiveStatus({ ...lng, surveillanceDoneAt: d('2027-01-05') }, false, d('2027-02-01')), 'current')
assert.equal(iso(effectiveExpiry({ ...lng, surveillanceDoneAt: d('2027-01-05') })), '2028-01-10')

// Follow-ups.
const actions = (rows: Array<[string, string | null, string]>) => rows.map(([q, due, status]) => ({ questionId: q, dueDate: due, status }))
const common = { issuedAt: d('2026-01-10'), expiresAt: d('2027-01-10'), completedDueOn: [] as string[], tracked: ['A', 'B'] }
// Milestone: latest due date among tracked actions; other indicators ignored.
let f = nextFollowUp({ ...common, mode: 'milestone', actions: actions([['A', '2026-05-01', 'In-Progress'], ['B', '2026-08-15', 'In-Progress'], ['Z', '2026-12-01', 'In-Progress']]), now: d('2026-03-01') })
assert.deepEqual(f, { dueOn: '2026-08-15', overdue: false, broughtForward: false })
f = nextFollowUp({ ...common, mode: 'milestone', actions: actions([['B', '2026-08-15', 'Off-Track']]), now: d('2026-09-01') })
assert.equal(f.overdue, true, 'missed point -> overdue')
// CIP complete brings the check forward, never later.
f = nextFollowUp({ ...common, mode: 'milestone', actions: actions([['A', '2026-05-01', 'Completed-Validated'], ['B', '2026-08-15', 'Completed-Validated']]), now: d('2026-03-01') })
assert.deepEqual(f, { dueOn: '2026-03-01', overdue: false, broughtForward: true })
// The CIP can never extend validity: a plan date past expiry is capped at expiry.
f = nextFollowUp({ ...common, mode: 'milestone', actions: actions([['A', '2027-06-01', 'In-Progress']]), now: d('2026-03-01') })
assert.equal(f.dueOn, '2027-01-10')
f = nextFollowUp({ ...common, mode: 'end_of_plan', actions: actions([['Z', '2029-01-01', 'In-Progress']]), now: d('2026-03-01') })
assert.equal(f.dueOn, '2027-01-10')
// Completed follow-ups are not re-asked.
f = nextFollowUp({ ...common, mode: 'milestone', completedDueOn: ['2026-08-15'], actions: actions([['B', '2026-08-15', 'In-Progress']]), now: d('2026-09-01') })
assert.deepEqual(f, { dueOn: null, overdue: false, broughtForward: false })
// Fixed intervals count from issue and skip those done.
f = nextFollowUp({ ...common, mode: 'fixed_3', actions: [], now: d('2026-02-01') })
assert.equal(f.dueOn, '2026-04-10')
f = nextFollowUp({ ...common, mode: 'fixed_3', completedDueOn: ['2026-04-10'], actions: [], now: d('2026-08-01') })
assert.deepEqual([f.dueOn, f.overdue], ['2026-07-10', true])
f = nextFollowUp({ ...common, mode: 'fixed_6', actions: [], now: d('2026-02-01') })
assert.equal(f.dueOn, '2026-07-10')
f = nextFollowUp({ ...common, mode: 'fixed_6', completedDueOn: ['2026-07-10'], actions: [], now: d('2026-08-01') })
assert.equal(f.dueOn, null, 'the next 6-month point is the expiry itself')
assert.equal(nextFollowUp({ ...common, mode: 'milestone', actions: [], now: d('2026-03-01') }).dueOn, null)

// Material events.
assert.equal(MATERIAL_EVENTS.length, 13)
assert.equal(MATERIAL_EVENTS.filter((e) => e.star).length, 4)
assert.equal(isStarred('fraud'), true)
assert.equal(isStarred('leadership_change'), false)
assert.equal(iso(reportingDeadline(d('2026-03-01'), false)), '2026-03-31')
// 5 working days from a Thursday skips the weekend.
assert.equal(iso(addWorkingDays(d('2026-10-15'), 5)), '2026-10-22')
assert.equal(iso(reportingDeadline(d('2026-10-15'), true)), '2026-10-22')
assert.equal(iso(addWorkingDays(d('2026-10-17'), 1)), '2026-10-19', 'from a Saturday')
assert.equal(statusAfterDecision('reinstate', 0), 'current')
assert.equal(statusAfterDecision('re_scope', 1), 'suspended', 'another open event keeps it suspended')
assert.equal(statusAfterDecision('withdraw', 3), 'withdrawn')

// Reminders: 30 and 7 days before, once each, never after the date.
assert.deepEqual(dueReminders('2026-06-30', [], d('2026-05-01')), [], 'too early')
assert.deepEqual(dueReminders('2026-06-30', [], d('2026-05-31')), [30])
assert.deepEqual(dueReminders('2026-06-30', [30], d('2026-06-24')), [7])
assert.deepEqual(dueReminders('2026-06-30', [30, 7], d('2026-06-29')), [])
assert.deepEqual(dueReminders('2026-06-30', [], d('2026-06-25')), [7], 'a job that missed the 30-day mark sends only the 7-day one')
assert.deepEqual(dueReminders('2026-06-30', [7], d('2026-06-25')), [])
assert.deepEqual(dueReminders('2026-06-30', [], d('2026-07-01')), [])
console.log('validationLifecycle.test.ts ok')
