import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const layout = readFileSync(new URL('./PublicLayout.tsx', import.meta.url), 'utf8')
const ui = readFileSync(new URL('./ui.tsx', import.meta.url), 'utf8')
const signInButtons = [...layout.matchAll(/<Button\b([^>]*)>\s*\{t\('nav\.signIn', 'Sign in'\)\}\s*<\/Button>/g)]

assert.equal(signInButtons.length, 2, 'desktop and mobile must both have a sign-in button')
for (const [, props] of signInButtons) {
  assert.doesNotMatch(props, /variant=/, 'sign-in must use the same default primary variant as registration')
  assert.match(props, /size="sm"/)
}
assert.match(signInButtons[1][1], /className="w-full justify-center"/, 'mobile sign-in must remain full-width')
assert.match(ui, /variant = 'primary'/)
assert.match(ui, /variant === 'primary' && 'bg-emerald-500 text-white [^']*hover:bg-emerald-600[^']*focus:ring-emerald-500'/)

console.log('PublicLayout.test.ts: all assertions passed')
