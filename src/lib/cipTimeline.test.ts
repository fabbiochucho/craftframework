// Self-check: `node src/lib/cipTimeline.test.ts`
import assert from 'node:assert/strict'
import { DEFAULT_TIMELINE, suggestTimeline, type TimelineInput } from './cipTimeline.ts'

const a = (id: string, severity: TimelineInput['severity'], extra: Partial<TimelineInput> = {}): TimelineInput =>
  ({ id, severity, owner: 'Head of Operations', domain: 'D', score: 1, tier: 1, ...extra })
const byId = (r: ReturnType<typeof suggestTimeline>, id: string) => r.actions.find((x) => x.id === id)!

// No default plan length: a single moderate gap gives a short plan, many criticals a longer one
const small = suggestTimeline([a('m1', 'Moderate', { score: 2 })], DEFAULT_TIMELINE)
assert.ok(small.planMonths <= 6, `one moderate gap is a short plan (${small.planMonths} months)`)
assert.ok(byId(small, 'm1').startWeek >= 13, 'moderate work starts within its window, not immediately')

// Windows: critical starts immediately and closes within 13 weeks when it can
const crit = suggestTimeline([a('c1', 'Critical', { actionType: 'policy' })], DEFAULT_TIMELINE)
assert.equal(byId(crit, 'c1').startWeek, 0)
assert.ok(byId(crit, 'c1').dueWeek <= 13)
assert.deepEqual(byId(crit, 'c1').flags, [])

// minWeeks is never compressed; if it can't fit the window the action is flagged with the reason
const long = suggestTimeline([a('c2', 'Critical', { minWeeks: 20 })], DEFAULT_TIMELINE)
assert.ok(byId(long, 'c2').durationWeeks >= 20)
assert.ok(byId(long, 'c2').flags.some((f) => /minimum of 20 weeks/.test(f)))

// Ordering: severity first, then lower ladder rung (tier) first
const ord = suggestTimeline([a('h1', 'High', { tier: 2 }), a('c3', 'Critical'), a('h0', 'High', { tier: 1 })], { ...DEFAULT_TIMELINE, orgSize: 'small' })
assert.deepEqual(ord.actions.map((x) => x.id), ['c3', 'h0', 'h1'])

// Dependencies: people after policy, practice after system, within a domain
const dep = suggestTimeline([a('p1', 'Critical', { actionType: 'people' }), a('p0', 'Critical', { actionType: 'policy' })], DEFAULT_TIMELINE)
assert.ok(byId(dep, 'p1').startWeek >= byId(dep, 'p0').dueWeek, 'training starts after the policy it trains on')
const dep2 = suggestTimeline([a('s1', 'High', { actionType: 'practice' }), a('s0', 'High', { actionType: 'system' })], DEFAULT_TIMELINE)
assert.ok(byId(dep2, 's1').startWeek >= byId(dep2, 's0').dueWeek)

// Capacity: a small organisation runs at most 2 actions per owner at once; overflow moves later and says why
const many = ['x1', 'x2', 'x3'].map((id) => a(id, 'Critical', { actionType: 'policy' }))
const cap = suggestTimeline(many, { ...DEFAULT_TIMELINE, orgSize: 'small' })
assert.equal(byId(cap, 'x3').startWeek, byId(cap, 'x1').dueWeek, 'third action waits for a free slot')
assert.ok(byId(cap, 'x3').flags.some((f) => /capacity/i.test(f)) || byId(cap, 'x3').dueWeek <= 13)
const capL = suggestTimeline(many, { ...DEFAULT_TIMELINE, orgSize: 'large' })
assert.equal(byId(capL, 'x3').startWeek, 0, 'a large organisation runs them together')

// Pace: accelerated shortens windows, extended lengthens them
const mod = [a('m2', 'Moderate', { score: 2 })]
assert.ok(byId(suggestTimeline(mod, { ...DEFAULT_TIMELINE, pace: 'accelerated' }), 'm2').startWeek < byId(suggestTimeline(mod, DEFAULT_TIMELINE), 'm2').startWeek)
assert.ok(byId(suggestTimeline(mod, { ...DEFAULT_TIMELINE, pace: 'extended' }), 'm2').startWeek > byId(suggestTimeline(mod, DEFAULT_TIMELINE), 'm2').startWeek)

// Target date: fits the plan to the chosen months and lists what cannot fit
const tgt = suggestTimeline([a('t1', 'Moderate', { score: 2 }), a('t2', 'High', { minWeeks: 30 })], { ...DEFAULT_TIMELINE, pace: 'target', targetMonths: 6 })
assert.ok(byId(tgt, 't1').dueWeek <= 27, 'scaled into a 6-month plan')
assert.deepEqual(tgt.cannotFit, ['t2'], 'an action whose minimum exceeds the target is listed')

// Fixed date: an action tied to a deadline is due before it, whatever its severity
const fx = suggestTimeline([a('f1', 'Moderate', { score: 2 })], { ...DEFAULT_TIMELINE, startDate: '2026-11-02', fixedDates: { f1: { date: '2027-01-04', label: 'Regulator filing' } } })
assert.ok(byId(fx, 'f1').dueWeek <= 9, 'due before the fixed date (9 weeks after start)')

// Override with a reason sets the due week (never below the minimum duration) and is recorded
const ov = suggestTimeline([a('o1', 'High', { minWeeks: 6 })], { ...DEFAULT_TIMELINE, overrides: { o1: { dueWeek: 40, reason: 'Board meets in July' } } })
assert.equal(byId(ov, 'o1').dueWeek, 40)
assert.ok(byId(ov, 'o1').flags.some((f) => /Board meets in July/.test(f)))
const ov2 = suggestTimeline([a('o2', 'High', { minWeeks: 6 })], { ...DEFAULT_TIMELINE, overrides: { o2: { dueWeek: 5, reason: 'Rush' } } })
assert.ok(byId(ov2, 'o2').dueWeek - byId(ov2, 'o2').startWeek >= 6, 'an override never compresses the minimum')

// Phases
const ph = suggestTimeline([a('q1', 'Critical'), a('q2', 'Moderate', { score: 2, actionType: 'system' }), a('q3', 'Moderate', { score: 2, actionType: 'practice', domain: 'E' })], DEFAULT_TIMELINE)
assert.deepEqual([byId(ph, 'q1').phase, byId(ph, 'q2').phase, byId(ph, 'q3').phase], [1, 2, 3])

// Change readiness below 2.5 adds embedding time to people and practice actions
const base = byId(suggestTimeline([a('e1', 'High', { actionType: 'people' })], DEFAULT_TIMELINE), 'e1').durationWeeks
const emb = byId(suggestTimeline([a('e1', 'High', { actionType: 'people' })], { ...DEFAULT_TIMELINE, changeReadiness: 1.5 }), 'e1')
assert.ok(emb.durationWeeks > base && emb.flags.some((f) => /embedding/i.test(f)))

assert.equal(suggestTimeline([], DEFAULT_TIMELINE).planMonths, 0)
console.log('cipTimeline: ok')

// Review fixes (stage 3)
import { normaliseTimeline } from './cipTimeline.ts'
{
  // 1. A fixed date that capacity or a prerequisite pushes past is reported, never claimed as met
  const crowd = ['k1', 'k2', 'k3', 'k4'].map((id) => a(id, 'Critical', { actionType: 'policy' }))
  const r = suggestTimeline([...crowd, a('lo', 'Moderate', { score: 2 })], { ...DEFAULT_TIMELINE, orgSize: 'small', startDate: '2027-01-04', fixedDates: { lo: { date: '2027-02-01', label: 'Reg' } } })
  const lo = byId(r, 'lo')
  assert.ok(lo.dueWeek <= 4 || (lo.flags.some((f) => /Cannot meet Reg/.test(f)) && r.cannotFit.includes('lo')), 'a missed fixed date is flagged and listed')
  const past = suggestTimeline([a('p', 'High')], { ...DEFAULT_TIMELINE, startDate: '2027-01-04', fixedDates: { p: { date: '2026-12-01', label: 'Old' } } })
  assert.ok(byId(past, 'p').flags.some((f) => /Cannot meet Old/.test(f)), 'a fixed date before the plan starts cannot be met')
  // 2. Target pace: durations never shrink below 60%, window starts never stretch
  const tiny = suggestTimeline([a('s', 'Moderate', { score: 2, actionType: 'system' }), a('l', 'Moderate', { score: 2 })], { ...DEFAULT_TIMELINE, pace: 'target', targetMonths: 1 })
  assert.ok(byId(tiny, 's').durationWeeks >= 6, 'a 10-week system action is at most 40% shorter')
  assert.ok(tiny.cannotFit.length > 0, 'a 1-month target lists what cannot fit')
  const wide = suggestTimeline([a('c', 'Critical'), a('h', 'High')], { ...DEFAULT_TIMELINE, pace: 'target', targetMonths: 24 })
  assert.ok(byId(wide, 'h').startWeek <= 4, 'a long target never delays the start of a High action')
  // 3. A dependent that waits on a later prerequisite says so
  const wait = suggestTimeline([a('cp', 'Critical', { actionType: 'people' }), a('lp', 'Moderate', { score: 2, actionType: 'policy' })], DEFAULT_TIMELINE)
  assert.ok(byId(wait, 'cp').flags.some((f) => /Waits for lp/.test(f)))
  // 4. Saved settings from older or newer clients never break the plan
  const n = normaliseTimeline({ pace: 'warp', orgSize: 'huge' } as never)
  assert.equal(n.pace, 'standard'); assert.equal(n.orgSize, 'medium'); assert.deepEqual(n.overrides, {}); assert.deepEqual(n.fixedDates, {})
  assert.equal(suggestTimeline([a('z1', 'High'), a('z2', 'High'), a('z3', 'High'), a('z4', 'High')], { orgSize: 'huge' } as never).actions.length, 4, 'unknown size does not hang')
  console.log('cipTimeline (review fixes): ok')
}
