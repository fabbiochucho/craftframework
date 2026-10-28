// Self-check: `node src/lib/videoWatch.test.ts` — counting how much of a training video was really played.
import assert from 'node:assert/strict'
import { WATCHED_PCT, createWatchTracker, playerProgress } from './videoWatch.ts'

// Normal playback, reported every quarter second, counts
const t = createWatchTracker()
for (let s = 0; s <= 100; s += 0.25) t.update(s, 100)
assert.equal(t.pct(), 100)

// Seeking to the end does not
const skip = createWatchTracker()
skip.update(0, 100); skip.update(1); skip.update(95); skip.update(100)
assert.ok(skip.pct() < 10, `seek counted: ${skip.pct()}%`)

// Re-watching the same part does not add up, and going back is not progress
const again = createWatchTracker()
for (let r = 0; r < 3; r++) { again.update(0, 100); for (let s = 0; s <= 50; s += 0.5) again.update(s) }
assert.equal(again.pct(), 50)

// Watching at 2x still counts; 89% is not enough
const fast = createWatchTracker()
for (let s = 0; s <= 89; s += 0.5) fast.update(s, 100)
assert.ok(fast.pct() < WATCHED_PCT)
fast.update(89.5); fast.update(90); fast.update(90.5)
assert.ok(fast.pct() >= WATCHED_PCT)

// No duration yet means 0%
assert.equal(createWatchTracker().update(10), 0)

// The player's messages, as strings or objects; anything else is ignored
assert.deepEqual(playerProgress('{"event":"infoDelivery","info":{"currentTime":12.5,"duration":700}}'), { currentTime: 12.5, duration: 700 })
assert.deepEqual(playerProgress({ event: 'infoDelivery', info: { currentTime: 3 } }), { currentTime: 3 })
assert.equal(playerProgress('not json'), null)
assert.equal(playerProgress({ event: 'onStateChange', info: 1 }), null)
assert.equal(playerProgress({ event: 'infoDelivery', info: { volume: 50 } }), null)

console.log('video watch: ok')
