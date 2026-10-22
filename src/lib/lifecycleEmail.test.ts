// Self-check — run directly with `node src/lib/lifecycleEmail.test.ts`.
import assert from 'node:assert/strict'
import { LIFECYCLE_VARIANTS, progressLines, renderLifecycleEmail, renderSample, SAMPLE_PROGRESS, type LifecycleEmailInput } from './lifecycleEmail.ts'
import { EMPTY_PROGRESS } from './lifecycle.ts'

const links = { cta: 'https://craft.example/api/lifecycle/go?t=cta', badge: 'https://craft.example/api/lifecycle/go?t=badge', survey: 'https://craft.example/api/lifecycle/go?t=survey',
  unsubscribe: 'https://craft.example/api/lifecycle/unsubscribe?t=u', preferences: 'https://craft.example/email-preferences?t=p' }
const input = (over: Partial<LifecycleEmailInput>): LifecycleEmailInput => ({
  kind: 'nudge_2w', variant: 'default', name: 'Amina Okoro', email: 'amina@riverbend.example', orgName: 'Riverbend Cooperative',
  appUrl: 'https://craft.example/', links, now: new Date('2026-10-21T00:00:00Z'), ...over,
})
// The CSS in <head> legitimately contains braces, so only the body is checked.
const visible = (s: string) => { const i = s.indexOf('<body'); return i >= 0 ? s.slice(i) : s }
const hasNoBraces = (s: string) => assert.ok(!/\{[^}]*\}|undefined|null|NaN/.test(visible(s)), `unfilled placeholder in: ${s.slice(0, 200)}`)

// Every variant, with and without an organisation name: nothing unfilled, signed, footed, plain text present.
for (const v of LIFECYCLE_VARIANTS) {
  for (const orgName of ['Riverbend Cooperative', '', null, undefined] as const) {
    const e = renderLifecycleEmail(input({ kind: v.kind, variant: v.variant, months: v.months, orgName, progress: v.variant === 'progress' ? SAMPLE_PROGRESS : undefined }))
    for (const body of [e.html, e.text, e.subject]) hasNoBraces(body)
    assert.ok(e.text.includes('Warm regards,\nAbiola & Pauline\nCRAFT team, DiBadili Institute'), `${v.id} text sign-off`)
    assert.ok(e.html.includes('Warm regards,') && e.html.includes('signature-abiola-pauline.png') && e.html.includes('>Abiola &amp; Pauline</p>') && e.html.includes('CRAFT team, DiBadili Institute'), `${v.id} html sign-off`)
    assert.ok(e.text.includes(`You're receiving this because you have a workspace on CRAFT. Unsubscribe from these emails: ${links.unsubscribe} · Email preferences: ${links.preferences} · © 2026 DiBadili Institute.`), `${v.id} footer`)
    assert.ok(e.html.includes(`href="${links.unsubscribe}"`) && e.html.includes(`href="${links.preferences}"`))
    assert.ok(e.text.startsWith('Hi Amina,\n\n'))
    if (!orgName?.trim()) assert.ok(e.text.includes('your organisation'), `${v.id} fallback organisation`)
  }
}

// Subjects and copy, exactly.
const nudge = renderLifecycleEmail(input({}))
assert.equal(nudge.subject, 'Ready to take your CRAFT readiness assessment, Amina?')
assert.ok(nudge.text.includes("It's been two weeks since you set up Riverbend Cooperative's workspace on CRAFT. The next step is the readiness assessment: it shows where Riverbend Cooperative stands on the Capital Readiness Ladder and what to work on first."))
assert.ok(nudge.text.includes("You don't have to finish it in one sitting. Your answers save as you go."))
assert.ok(nudge.text.includes(`Start the assessment: ${links.cta}`))
assert.ok(nudge.text.includes("If something is in the way, just reply and tell us. We're happy to walk you through it."))
assert.equal(renderLifecycleEmail(input({ kind: 'feedback_1m', variant: 'active' })).subject, "One month with CRAFT: how's it going, Amina?")
assert.equal(renderLifecycleEmail(input({ kind: 'feedback_1m', variant: 'inactive' })).subject, 'One month in: can we help, Amina?')
assert.ok(renderLifecycleEmail(input({ kind: 'feedback_1m', variant: 'active' })).text.includes('Share your feedback:'))
assert.ok(renderLifecycleEmail(input({ kind: 'feedback_1m', variant: 'inactive' })).text.includes('Tell us how we can help:'))
assert.ok(renderLifecycleEmail(input({ kind: 'feedback_1m', variant: 'inactive' })).text.includes("it looks like you haven't had a chance to get started yet"))
assert.equal(renderLifecycleEmail(input({ kind: 'checkin' })).subject, 'Checking in from CRAFT')
assert.ok(renderLifecycleEmail(input({ kind: 'checkin' })).text.includes('Pick up where you left off:'))
const subjects: Array<[number, string]> = [[3, 'Three months on CRAFT, Amina!'], [6, 'Six months on CRAFT, Amina!'], [12, 'Happy one-year CRAFT anniversary, Amina!'],
  [18, 'One and a half years on CRAFT, Amina!'], [24, 'Happy two-year CRAFT anniversary, Amina!'], [30, 'Two and a half years on CRAFT, Amina!']]
for (const [months, subject] of subjects) for (const variant of ['progress', 'quiet'] as const) {
  assert.equal(renderLifecycleEmail(input({ kind: 'milestone', variant, months, progress: SAMPLE_PROGRESS })).subject, subject)
}

// Progress lines: only real, non-zero values.
assert.deepEqual(progressLines(EMPTY_PROGRESS), [])
assert.deepEqual(progressLines(SAMPLE_PROGRESS), [
  '2 readiness assessments completed', 'Capital Readiness Ladder: from rung 2 to rung 4', '7 improvement actions completed', '18 documents in your Data Room', 'Independently validated at rung 3',
])
assert.deepEqual(progressLines({ ...EMPTY_PROGRESS, assessmentsCompleted: 1, currentRung: 3, startRung: 3, documents: 1 }), [
  '1 readiness assessment completed', 'Capital Readiness Ladder: currently at rung 3', '1 document in your Data Room',
])
const partial = renderLifecycleEmail(input({ kind: 'milestone', variant: 'progress', months: 6, progress: { ...EMPTY_PROGRESS, documents: 4 }, links: { ...links, survey: undefined } }))
assert.ok(partial.text.includes('- 4 documents in your Data Room'))
for (const zero of [' 0 ', 'rung 0', 'assessments completed', 'improvement actions', 'Independently validated']) assert.ok(!partial.text.includes(zero), `zero line hidden: ${zero}`)
// A "progress" email with nothing to show becomes the quiet one rather than an empty list.
const empty = renderLifecycleEmail(input({ kind: 'milestone', variant: 'progress', months: 6, progress: EMPTY_PROGRESS }))
assert.ok(empty.text.includes('your workspace is exactly as you left it') && !empty.text.includes("Here's what"))
// Progress buttons; survey line only on anniversaries (12, 24 …), not 3, 6 or 18.
const prog = (months: number) => renderLifecycleEmail(input({ kind: 'milestone', variant: 'progress', months, progress: SAMPLE_PROGRESS }))
assert.ok(prog(6).text.includes(`See your progress: ${links.cta}`) && prog(6).text.includes(`Download your CRAFT member badge: ${links.badge}`))
assert.ok(!prog(6).text.includes('How are we doing?') && !prog(18).text.includes('How are we doing?'))
assert.ok(prog(12).text.includes(`How are we doing? Tell us in two minutes: ${links.survey}`) && prog(24).text.includes('How are we doing?'))
assert.ok(prog(12).text.includes('Today marks one year since Riverbend Cooperative joined CRAFT. Thank you for being part of the CRAFT community.'))
assert.ok(prog(18).text.includes('Today marks one and a half years since'))
const quiet = renderLifecycleEmail(input({ kind: 'milestone', variant: 'quiet', months: 3 }))
assert.ok(quiet.text.includes('Today marks three months since Riverbend Cooperative joined CRAFT. Thank you for being with us.'))
assert.ok(quiet.text.includes(`Continue on CRAFT: ${links.cta}`) && !quiet.text.includes('badge'))

// Escaping and the first-name fallback.
const x = renderLifecycleEmail(input({ name: '<b>x</b>', orgName: 'A&B <i>Co</i>' }))
assert.ok(!x.html.includes('<b>x') && !x.html.includes('<i>Co') && x.html.includes('A&amp;B &lt;i&gt;Co'))
assert.ok(renderLifecycleEmail(input({ name: '', email: 'kofi.mensah@x.example' })).subject.endsWith('Kofi?'))
assert.equal(renderSample('nope', 'https://craft.example'), null)
for (const v of LIFECYCLE_VARIANTS) assert.ok(renderSample(v.id, 'https://craft.example'), v.id)
console.log('lifecycleEmail.test.ts ok')
