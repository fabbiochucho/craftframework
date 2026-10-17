import assert from 'node:assert/strict'
import { safeNextPath } from './safeNext.ts'

for (const ok of ['/onboarding', '/dashboard?tab=1', '/app/workspaces#x']) assert.equal(safeNextPath(ok), ok)
for (const bad of [
  null, undefined, '', 'onboarding', 'https://evil.example/', 'http://evil.example', '//evil.example', '///evil.example',
  '/\\evil.example', '\\\\evil.example', 'javascript:alert(1)', '/\t/evil.example', '/%0d%0a' + '\n', ' /onboarding', '/' + 'a'.repeat(600),
]) assert.equal(safeNextPath(bad as string), null, String(bad))
console.log('safeNext.test.ts: all assertions passed')
