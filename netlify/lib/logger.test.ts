// Self-check — run directly with `node netlify/lib/logger.test.ts`.
import assert from 'node:assert/strict'
import { logger } from './logger.ts'

function captureConsole(fn: () => void): string {
  let captured = ''
  const original = console.error
  console.error = (line: string) => { captured = line }
  try {
    fn()
  } finally {
    console.error = original
  }
  return captured
}

{
  const line = captureConsole(() => logger.error('test-scope', 'something broke', new Error('boom')))
  const parsed = JSON.parse(line)
  assert.equal(parsed.level, 'error')
  assert.equal(parsed.scope, 'test-scope')
  assert.equal(parsed.message, 'something broke')
  assert.equal(parsed.error.message, 'boom')
  assert.ok(typeof parsed.error.stack === 'string', 'Error stack should serialize as a string, not be dropped')
  assert.ok(typeof parsed.time === 'string')
}

{
  // A non-Error thrown value (e.g. a string or plain object) must still serialize, not throw.
  const line = captureConsole(() => logger.error('test-scope', 'weird throw', 'just a string'))
  const parsed = JSON.parse(line)
  assert.equal(parsed.error, 'just a string')
}

console.log('logger: all checks passed')
