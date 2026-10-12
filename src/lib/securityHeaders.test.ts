// Self-check — run directly with `node src/lib/securityHeaders.test.ts`.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { securityHeaders } from './securityHeaders.ts'

const h = new Map(securityHeaders(readFileSync('netlify.toml', 'utf8')))
assert.equal(h.get('X-Frame-Options'), 'DENY')
assert.match(h.get('Content-Security-Policy')!, /default-src 'self'.*'wasm-unsafe-eval'.*font-src 'self' data:/)
assert.ok(!h.has('Cache-Control'), 'only the "/*" block is read')
assert.throws(() => securityHeaders('[build]'))
console.log('securityHeaders.test.ts: all assertions passed')
