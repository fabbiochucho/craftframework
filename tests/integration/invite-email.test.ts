// The invitation email: who invited you, what you can do (tailored), why CRAFT, the accept link
// and explore links; every interpolated value escaped. Runs with the integration suite (it resolves extensionless imports).
import assert from 'node:assert/strict'
import { buildWelcomeEmail, buildWelcomeEmailHtml, inviteFeatures, INVITE_PITCH } from '../../src/lib/inviteEmail.ts'

const member = {
  name: 'Ada Obi', email: 'ada@x.example', role: 'assessor' as const, scopeLabel: 'Acme Cooperative',
  inviterName: 'Ines Inviter', inviterEmail: 'ines@acme.example', acceptUrl: 'https://craft.example/accept/tok123',
  siteUrl: 'https://craft.example', message: 'Looking forward to working together',
}
const m = buildWelcomeEmailHtml(member)
const mt = buildWelcomeEmail(member).body
assert.equal(m.subject, 'Ines Inviter invited you to CRAFT: Organization Assessor')
// Every exact link in the output (href values and bare URLs), compared whole, never as a substring.
const links = (out: string) => new Set(out.match(/https?:\/\/[^\s"<>]+/g) ?? [])
for (const out of [m.html, mt]) {
  assert.ok(out.includes('Ines Inviter') && out.includes('ines@acme.example'), 'who invited them')
  assert.ok(out.includes('Acme Cooperative'), 'which organisation')
  assert.ok(out.includes('Looking forward to working together'), 'their note')
  assert.ok(links(out).has('https://craft.example/accept/tok123'), 'the real accept link')
  assert.ok(out.includes('Assessment wizard'), 'features for the role')
  for (const p of INVITE_PITCH) assert.ok(out.includes(p.title), `pitch: ${p.title}`)
  for (const path of ['demo', 'methodology', 'pre-assessment']) assert.ok(links(out).has(`https://craft.example/${path}`), `explore link: ${path}`)
  assert.ok(out.includes('nothing happens unless you accept'), 'safe to ignore')
}

const org = { ...member, kind: 'organization' as const, orgName: 'NewCo Health', orgType: 'Civil Society · NGO · Nigeria', purpose: 'Adds you to the portfolio "East Africa NGOs".', expiresInDays: 14 }
const o = buildWelcomeEmailHtml(org)
const ot = buildWelcomeEmail(org).body
assert.equal(o.subject, 'Ines Inviter invited NewCo Health to CRAFT')
for (const out of [o.html, ot]) {
  assert.ok(out.includes('NewCo Health') && out.includes('14 days'))
  assert.ok(out.includes('Civil Society · NGO · Nigeria'), 'organisation type')
  assert.ok(out.includes('Readiness assessment') && out.includes('Independent validation'), 'institution features')
  assert.ok(!out.includes('Assessment wizard'), 'not the team-member features')
}
assert.ok(o.html.includes('East Africa NGOs'))

// Different roles get different features.
assert.notDeepEqual(inviteFeatures({ role: 'portfolio' }), inviteFeatures({ role: 'independent' }))
assert.ok(inviteFeatures({ role: 'portfolio' }).some((f) => f.title === 'Portfolio view'))

// Escaping: nothing the inviter typed can inject markup.
const evil = '<img src=x onerror=alert(1)>'
const e = buildWelcomeEmailHtml({ ...org, name: evil, inviterName: evil, orgName: evil, message: evil, purpose: evil, scopeLabel: evil })
assert.ok(!e.html.includes('<img src=x'), 'escaped')
assert.ok(e.html.includes('&lt;img src=x onerror=alert(1)&gt;'))

console.log('inviteEmail: ok')
