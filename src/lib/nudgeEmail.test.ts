import assert from 'node:assert/strict'
import { NUDGE_SUBJECT, firstNameOf, renderNudgeEmail } from './nudgeEmail.ts'

const base = {
  name: 'Amina Okoro', email: 'amina@riverbend.example', orgName: 'Riverbend Cooperative', startedAt: new Date('2026-10-03T09:00:00Z'),
  step: 2, appUrl: 'https://craft.example/', optOutUrl: 'https://craft.example/api/onboarding-optout?t=abc', now: new Date('2026-10-17T00:00:00Z'),
}

const m = renderNudgeEmail({ ...base, note: 'Happy to jump on a call.' })
assert.equal(m.subject, 'Finish setting up your CRAFT workspace')
assert.equal(NUDGE_SUBJECT, m.subject)
assert.equal(m.ctaUrl, 'https://craft.example/auth?next=/onboarding%3Fstep%3D2')
// Every placeholder is filled, in both versions.
for (const body of [m.text, m.html]) {
  assert.doesNotMatch(body, /\{[^}]*\}|undefined|null|NaN/)
  assert.match(body, /Hi Amina,/)
  assert.match(body, /Riverbend Cooperative’s/)
  assert.match(body, /3 October 2026/)
  assert.match(body, /step 2 of 3: Donor Alignment/)
  assert.match(body, /Happy to jump on a call\./)
  assert.match(body, /© 2026 DiBadili Institute/)
  assert.match(body, /Capital Readiness Ladder/)
}
// Honest copy: progress is saved, and says so.
for (const body of [m.text, m.html]) {
  assert.match(body, /Everything you entered has been saved\. What’s left:/)
  assert.doesNotMatch(body, /Here’s what’s left/)
}
// Remaining steps: the one stopped at and every later one, not the finished ones.
assert.match(m.text, /- Donor Alignment\n- Team & Import/)
assert.doesNotMatch(m.text, /- Workspace/)
// Plain URL in text, a real button (anchor) in HTML.
assert.match(m.text, /https:\/\/craft\.example\/auth\?next=\/onboarding%3Fstep%3D2/)
assert.match(m.html, /<a href="https:\/\/craft\.example\/auth\?next=\/onboarding%3Fstep%3D2"[^>]*>Continue where you left off<\/a>/)
assert.match(m.text, /Stop them here: https:\/\/craft\.example\/api\/onboarding-optout\?t=abc\./)
assert.match(m.html, /href="https:\/\/craft\.example\/api\/onboarding-optout\?t=abc"/)
assert.match(m.text, /Just reply to this email/)

// Fallback organisation name, and no note block when there is no note.
for (const orgName of [undefined, null, '', '   ']) {
  const f = renderNudgeEmail({ ...base, orgName, step: 1 })
  assert.match(f.text, /setting up your organisation’s workspace/)
  assert.match(f.text, /- Workspace\n- Donor Alignment\n- Team & Import/)
  assert.doesNotMatch(f.html, /A note from the CRAFT team/)
}
// Out-of-range steps are clamped; user text is escaped.
assert.match(renderNudgeEmail({ ...base, step: 9 }).text, /step 3 of 3: Team & Import/)
const x = renderNudgeEmail({ ...base, name: '<b>Eve</b>', email: 'eve@x.example', orgName: 'A&B <script>', note: '<img src=x onerror=1>' })
assert.doesNotMatch(x.html, /<(script|img|b)[\s>]/i)
assert.match(x.html, /A&amp;B &lt;script&gt;/)
assert.equal(firstNameOf('', 'jo.smith@x.example'), 'Jo')
assert.equal(firstNameOf('jo@x.example', 'jo@x.example'), 'Jo')
console.log('nudgeEmail.test.ts: all assertions passed')
