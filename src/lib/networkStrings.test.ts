import assert from 'node:assert/strict'
import { networkStrings, parseCsv } from './networkStrings.ts'

const s = networkStrings()
assert.ok(s.length > 900, `all assessment strings collected (${s.length})`)
assert.equal(new Set(s).size, s.length, 'unique')
assert.ok(s.includes('Totals only: counted in network results, never named (small groups are hidden)'))
assert.ok(s.some((x) => /State key populations strategy/.test(x)), 'NACA scorecard items included')
assert.ok(s.every((x) => x === x.trim() && x.length > 0))

assert.deepEqual(parseCsv('english,translation\n"Hello, world","Bonjour, le ""monde"""\r\nPlain,Simple\n\n'), [
  ['english', 'translation'], ['Hello, world', 'Bonjour, le "monde"'], ['Plain', 'Simple'],
])
assert.deepEqual(parseCsv('a,"multi\nline"'), [['a', 'multi\nline']])
console.log('networkStrings.test.ts ok')
