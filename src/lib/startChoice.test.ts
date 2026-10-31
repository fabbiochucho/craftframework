import assert from 'node:assert/strict'
import { START_PATH, readStartChoice, saveStartChoice, unconfiguredHome } from './startChoice.ts'

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }
const s = mem()
assert.equal(readStartChoice(s), null)
saveStartChoice('funder', s)
assert.equal(readStartChoice(s), 'funder')
s.setItem('craft-start-choice', 'hacker')
assert.equal(readStartChoice(s), null, 'unknown values are ignored')
const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
assert.equal(readStartChoice(broken), null, 'blocked storage just asks again')
saveStartChoice('network', broken)
assert.equal(unconfiguredHome(null), '/start')
assert.equal(unconfiguredHome('organisation'), '/onboarding')
assert.equal(unconfiguredHome('network'), '/start')
assert.deepEqual(Object.keys(START_PATH), ['organisation', 'validator', 'funder', 'network'])
console.log('startChoice.test.ts ok')
