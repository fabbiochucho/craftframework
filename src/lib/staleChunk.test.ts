// Self-check — run directly with `node src/lib/staleChunk.test.ts`.
import assert from 'node:assert/strict'
import { isStaleChunkError, reloadForStaleChunk } from './staleChunk.ts'

const stale = new TypeError('Failed to fetch dynamically imported module: https://craftframework.becomechange.institute/assets/x.js')
assert.ok(isStaleChunkError(stale))
assert.ok(isStaleChunkError(new TypeError('error loading dynamically imported module: /assets/y.js')), 'Firefox wording')
assert.ok(isStaleChunkError(new TypeError('Importing a module script failed.')), 'Safari wording')
assert.ok(!isStaleChunkError(new Error('Something else')))

const mem = new Map<string, string>()
const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
let reloads = 0
const reload = () => { reloads++ }
assert.equal(reloadForStaleChunk(new Error('other'), storage, reload, 1_000_000), false)
assert.equal(reloadForStaleChunk(stale, storage, reload, 1_000_000), true, 'first stale error reloads')
assert.equal(reloadForStaleChunk(stale, storage, reload, 1_030_000), false, 'not again within a minute (no loop)')
assert.equal(reloadForStaleChunk(stale, storage, reload, 1_070_000), true, 'a later deploy can reload again')
assert.equal(reloads, 2)
assert.equal(reloadForStaleChunk(stale, undefined, reload), false, 'no storage: never reload (no guard)')
const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => {} }
assert.equal(reloadForStaleChunk(stale, throwing, reload), false, 'blocked storage: never reload')
console.log('staleChunk ok')
