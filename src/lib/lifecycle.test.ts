// Self-check — run directly with `node src/lib/lifecycle.test.ts`.
import assert from 'node:assert/strict'
import {
  addMonthsUtc, CAP_DAYS, dueItems, emailHasSurvey, hasProgress, isActive, isDemoEmail, isMilestoneMonths, isSendDay, milestoneAsksFeedback,
  milestoneLabel, milestoneMonthsAt, milestoneSubject, nextSendDay, planForPerson, scheduledItems, EMPTY_PROGRESS, type PlanInput, type SentRow,
} from './lifecycle.ts'

const d = (s: string) => new Date(`${s}T09:00:00Z`)

// --- the schedule maths -------------------------------------------------------------------------------------------
const done = d('2026-01-05') // a Monday
assert.deepEqual(dueItems(done, d('2026-01-18')), [])
assert.deepEqual(dueItems(done, d('2026-01-19')).map((i) => `${i.kind}:${i.occurrence}`), ['nudge_2w:1'], 'day 14')
assert.deepEqual(dueItems(done, d('2026-02-04')).map((i) => i.kind), ['nudge_2w', 'feedback_1m'], 'day 30')
assert.equal(dueItems(done, d('2026-02-04'))[1].dueAt.toISOString().slice(0, 10), '2026-02-04')
// Months 3, 6, 12, then every 6.
assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(milestoneMonthsAt), [3, 6, 12, 18, 24, 30, 36, 42])
const months = (until: string) => dueItems(done, d(until)).filter((i) => i.kind === 'milestone').map((i) => i.occurrence)
assert.deepEqual(months('2026-04-04'), [])
assert.deepEqual(months('2026-04-05'), [3])
assert.deepEqual(months('2027-01-05'), [3, 6, 12])
assert.deepEqual(months('2029-01-05'), [3, 6, 12, 18, 24, 30, 36])
for (const m of [3, 6, 12, 18, 24, 30, 36, 42, 48]) assert.ok(isMilestoneMonths(m), `${m} is a milestone`)
for (const m of [1, 2, 4, 5, 9, 10, 13, 15, 21]) assert.ok(!isMilestoneMonths(m), `${m} is not`)
assert.equal(addMonthsUtc(d('2026-08-31'), 6).toISOString().slice(0, 10), '2027-02-28', 'end of month clamps')
assert.equal(addMonthsUtc(d('2026-01-31'), 1).toISOString().slice(0, 10), '2026-02-28')
assert.deepEqual(scheduledItems(done, d('2026-01-01'), d('2026-01-25')).map((i) => i.kind), ['nudge_2w'])

// --- labels and subjects ------------------------------------------------------------------------------------------
const labels: Array<[number, string]> = [[3, 'three months'], [6, 'six months'], [12, 'one year'], [18, 'one and a half years'], [24, 'two years'],
  [30, 'two and a half years'], [36, 'three years'], [42, 'three and a half years'], [48, 'four years'], [120, 'ten years']]
for (const [m, label] of labels) assert.equal(milestoneLabel(m), label)
assert.equal(milestoneSubject(3, 'Amina'), 'Three months on CRAFT, Amina!')
assert.equal(milestoneSubject(6, 'Amina'), 'Six months on CRAFT, Amina!')
assert.equal(milestoneSubject(12, 'Amina'), 'Happy one-year CRAFT anniversary, Amina!')
assert.equal(milestoneSubject(18, 'Amina'), 'One and a half years on CRAFT, Amina!')
assert.equal(milestoneSubject(24, 'Amina'), 'Happy two-year CRAFT anniversary, Amina!')
assert.equal(milestoneSubject(30, 'Amina'), 'Two and a half years on CRAFT, Amina!')
assert.equal(milestoneSubject(36, 'Amina'), 'Happy three-year CRAFT anniversary, Amina!')
assert.ok(!milestoneAsksFeedback(6) && milestoneAsksFeedback(12) && !milestoneAsksFeedback(18) && milestoneAsksFeedback(24), 'survey line on anniversaries')
assert.ok(emailHasSurvey('feedback_1m', 1, 'inactive') && emailHasSurvey('milestone', 12, 'progress') && !emailHasSurvey('milestone', 12, 'quiet') && !emailHasSurvey('nudge_2w', 1, 'default'))

// --- the Tuesday-Thursday window ----------------------------------------------------------------------------------
const week = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11'].map(d) // Mon..Sun
assert.deepEqual(week.map(isSendDay), [false, true, true, true, false, false, false])
assert.equal(nextSendDay(d('2026-01-09')).toISOString().slice(0, 10), '2026-01-13', 'Friday waits for Tuesday')
assert.equal(nextSendDay(d('2026-01-07')).toISOString().slice(0, 10), '2026-01-07')

// --- planning one person ------------------------------------------------------------------------------------------
const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  completedAt: done, lastSeenAt: d('2026-01-05'), now: d('2026-01-20'), startedAssessment: false,
  optedOut: { checkins: false, celebrations: false }, history: [], ...over,
})
const sent = (kind: SentRow['kind'], occurrence: number, at: string, outcome: SentRow['outcome'] = 'accepted', attempts = 1): SentRow => ({ kind, occurrence, at: d(at), outcome, attempts })

// Catch-up: due on Monday 19 Jan, the first send day is Tuesday 20 Jan: it goes then, not skipped.
assert.deepEqual(planForPerson(base()).send, { kind: 'nudge_2w', occurrence: 1 })
assert.equal(planForPerson(base({ now: d('2026-01-19') })).send?.kind, 'nudge_2w', 'planning is by due time; the Tue-Thu window is the caller\'s gate')
// Only if the assessment has not started; the item is then recorded as moot.
const moot = planForPerson(base({ startedAssessment: true }))
assert.equal(moot.send, null)
assert.deepEqual(moot.skips, [{ kind: 'nudge_2w', occurrence: 1, reason: 'assessment_started' }])
// Once sent it is not sent again.
assert.equal(planForPerson(base({ history: [sent('nudge_2w', 1, '2026-01-13')] })).send, null)
// Not due yet.
assert.equal(planForPerson(base({ now: d('2026-01-14') })).send, null)
// Category opt-outs are independent.
assert.equal(planForPerson(base({ optedOut: { checkins: true, celebrations: false } })).send, null)
assert.equal(planForPerson(base({ now: d('2026-04-07'), optedOut: { checkins: true, celebrations: false }, history: [] })).send?.kind, 'milestone')
assert.equal(planForPerson(base({ now: d('2026-04-07'), optedOut: { checkins: false, celebrations: true }, history: [sent('nudge_2w', 1, '2026-01-20'), sent('feedback_1m', 1, '2026-02-10')] })).send?.kind, 'checkin', 'celebrations off: the check-in can still go')

// The 14-day cap: day 30 falls due 16 days after a 14 Jan nudge here, so it goes; one sent on 3 Feb holds the next back until the 17th.
const afterNudge = [sent('nudge_2w', 1, '2026-01-20')]
assert.equal(planForPerson(base({ now: d('2026-02-04'), history: afterNudge })).send?.kind, 'feedback_1m', '15 days after: allowed')
assert.deepEqual(planForPerson(base({ now: d('2026-02-03'), history: [sent('nudge_2w', 1, '2026-01-21')] })).send, null, 'not due yet')
const capped = planForPerson(base({ now: d('2026-02-04'), history: [sent('nudge_2w', 1, '2026-01-22')] }))
assert.equal(capped.send, null)
assert.equal(capped.waiting, 'cap', '13 days after: waits')
assert.equal(planForPerson(base({ now: d('2026-02-05'), history: [sent('nudge_2w', 1, '2026-01-22')] })).send?.kind, 'feedback_1m', 'exactly 14 UTC days later, whatever the time of day')
assert.equal(CAP_DAYS, 14)
// A 09:00:05 send does not hold back the 09:00:00 run two weeks later.
const late = { ...sent('nudge_2w', 1, '2026-01-20'), at: new Date('2026-01-20T09:00:05Z') }
assert.equal(planForPerson(base({ now: new Date('2026-02-03T09:00:00Z'), startedAssessment: true, lastSeenAt: d('2026-02-03'), history: [late], completedAt: d('2026-01-04') })).send?.kind, 'feedback_1m')
// A failed send does not count towards the cap and is retried, up to 3 attempts.
const failedOnce = [sent('nudge_2w', 1, '2026-01-20', 'failed', 1)]
assert.equal(planForPerson(base({ now: d('2026-01-21'), history: failedOnce })).send?.kind, 'nudge_2w', 'retry after a failure')
assert.equal(planForPerson(base({ now: d('2026-01-21'), history: [sent('nudge_2w', 1, '2026-01-20', 'failed', 3)] })).send, null, 'gives up after 3 attempts')

// Collision priority: milestone > feedback > nudge > check-in.
const old = base({ completedAt: d('2025-10-01'), lastSeenAt: d('2025-10-01'), now: d('2026-01-07'), startedAssessment: false })
assert.equal(planForPerson(old).send?.kind, 'milestone', 'three months beats the check-in (and the expired nudge/feedback are dropped)')
const collide = base({ completedAt: d('2025-10-08'), lastSeenAt: d('2025-10-08'), now: d('2026-01-08'), history: [sent('nudge_2w', 1, '2025-10-22'), sent('feedback_1m', 1, '2025-11-12')] })
assert.deepEqual(planForPerson(collide).send, { kind: 'milestone', occurrence: 3 }, 'check-in and milestone both due: the milestone goes')
assert.equal(planForPerson({ ...collide, history: [...collide.history, sent('milestone', 3, '2026-01-08')], now: d('2026-01-22') }).send?.kind, 'checkin', 'the check-in follows two weeks later')
const both = planForPerson(base({ now: d('2026-02-04') }))
assert.deepEqual(both.send, { kind: 'feedback_1m', occurrence: 1 }, 'feedback outranks a nudge that is also still waiting')

// Stale one-offs are dropped, not sent late with the wrong words.
const stale = planForPerson(base({ now: d('2026-03-10'), lastSeenAt: d('2026-03-09') }))
assert.deepEqual(stale.skips.map((s) => `${s.kind}:${s.reason}`), ['nudge_2w:expired', 'feedback_1m:expired'])
// Several milestones due at once: only the latest is sent.
const backlog = planForPerson(base({ completedAt: d('2024-01-02'), lastSeenAt: d('2026-01-19'), now: d('2026-01-20'), history: [sent('nudge_2w', 1, '2024-01-16'), sent('feedback_1m', 1, '2024-02-06')] }))
assert.deepEqual(backlog.send, { kind: 'milestone', occurrence: 24 })
assert.deepEqual(backlog.skips.map((s) => `${s.occurrence}:${s.reason}`), ['3:superseded', '6:superseded', '12:superseded', '18:superseded'])

// Check-ins: away 30+ days, at most once per 90.
const away = (now: string, seen: string, history: SentRow[] = []) => planForPerson(base({
  completedAt: d('2025-01-02'), lastSeenAt: d(seen), now: d(now), history: [sent('nudge_2w', 1, '2025-01-16'), sent('feedback_1m', 1, '2025-02-06'), ...[3, 6, 12, 18].map((m) => sent('milestone', m, '2025-01-01')), ...history],
}))
assert.equal(away('2026-03-10', '2026-02-12').send, null, '26 days away')
assert.deepEqual(away('2026-03-10', '2026-02-08').send, { kind: 'checkin', occurrence: 1 }, '30 days away')
assert.equal(away('2026-04-20', '2026-02-08', [sent('checkin', 1, '2026-03-10')]).send, null, 'last check-in 41 days ago')
assert.equal(away('2026-06-07', '2026-02-08', [sent('checkin', 1, '2026-03-10')]).send, null, '89 days after the last')
assert.deepEqual(away('2026-06-08', '2026-02-08', [sent('checkin', 1, '2026-03-10')]).send, { kind: 'checkin', occurrence: 2 }, '90 days after the last')

// --- variants -----------------------------------------------------------------------------------------------------
assert.equal(isActive(done, done, false), false, 'signed in only the day they onboarded')
assert.equal(isActive(done, d('2026-01-06'), false), true, 'signed in later')
assert.equal(isActive(done, null, true), true, 'did something')
assert.equal(hasProgress(EMPTY_PROGRESS), false)
assert.equal(hasProgress({ ...EMPTY_PROGRESS, documents: 1 }), true)
assert.equal(hasProgress({ ...EMPTY_PROGRESS, currentRung: 0 }), false)

// --- who is never emailed ------------------------------------------------------------------------------------------
assert.ok(isDemoEmail('a.okeke@craft.demo') && isDemoEmail('x@sandbox.demo') && !isDemoEmail('amina@riverbend.example'))
console.log('lifecycle.test.ts ok')
