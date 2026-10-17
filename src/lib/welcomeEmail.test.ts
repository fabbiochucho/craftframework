// Self-check — run directly with `node src/lib/welcomeEmail.test.ts`.
import assert from 'node:assert/strict'
import { renderWelcomeEmail, WELCOME_FALLBACK_ORG } from './welcomeEmail.ts'
import { craftReplyTo, CRAFT_REPLY_TO_DEFAULT } from './emailSignature.ts'

const base = { name: 'Amina Bello', email: 'amina@ngo.example', appUrl: 'https://craft.example/', now: new Date('2026-10-17T00:00:00Z') }

const e = renderWelcomeEmail({ ...base, orgName: 'Riverbend Trust' })
assert.equal(e.subject, 'Welcome to CRAFT, Amina')
assert.equal(e.ctaUrl, 'https://craft.example/dashboard')
for (const body of [e.html, e.text]) {
  assert.ok(body.includes('Thank you for choosing CRAFT'), 'thanks them')
  assert.ok(body.includes('Riverbend Trust’s workspace'), 'organisation name')
  assert.ok(body.includes('Capacity Improvement Plan'), 'three starting steps')
  assert.ok(!/\{[a-z ]+\}/i.test(body), 'no unfilled placeholder')
  assert.ok(body.includes('2026 DiBadili Institute'), 'footer year')
}
// Signature: image with an absolute URL; its alt text carries the names when images are blocked.
assert.ok(e.html.includes('<img src="https://craft.example/email/signature-abiola-pauline.png"'))
assert.ok(e.html.includes('alt="Abiola &amp; Pauline"'))
assert.equal(e.html.split('Abiola &amp; Pauline').length - 1, 1, 'names appear once (as alt text), not duplicated')
assert.ok(e.text.includes('Warm regards,\nAbiola & Pauline\nCRAFT team, DiBadili Institute'))
assert.ok(e.text.includes('Go to your dashboard: https://craft.example/dashboard'))

// Fallbacks and escaping.
const f = renderWelcomeEmail({ ...base, name: '', email: 'kofi.mensah@x.example', orgName: '  ' })
assert.equal(f.subject, 'Welcome to CRAFT, Kofi')
assert.ok(f.text.includes(`${WELCOME_FALLBACK_ORG}’s workspace`))
const x = renderWelcomeEmail({ ...base, name: '<script>x</script>', orgName: 'A&B <b>Co</b>' })
assert.ok(!x.html.includes('<script>') && !x.html.includes('<b>Co</b>'))
assert.ok(x.html.includes('A&amp;B &lt;b&gt;Co&lt;/b&gt;'))

// Reply-to.
assert.equal(craftReplyTo({}), CRAFT_REPLY_TO_DEFAULT)
assert.equal(craftReplyTo({ CRAFT_REPLY_TO: ' team@example.org ' }), 'team@example.org')
console.log('welcomeEmail.test.ts: all assertions passed')
