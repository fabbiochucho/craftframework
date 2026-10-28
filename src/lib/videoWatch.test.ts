// Self-check: `node src/lib/videoWatch.test.ts` — the server's rules for crediting a watched training video.
import assert from 'node:assert/strict'
import { HEARTBEAT_SECONDS, WATCHED_PCT, creditProgress, newWatch, watchedPct } from './videoWatch.ts'

const LEN = 600 // a 10-minute video
const play = (from: number, to: number, rate = 1, s = newWatch(0)) => {
  let st = s
  for (let pos = from + HEARTBEAT_SECONDS * rate; pos <= to; pos += HEARTBEAT_SECONDS * rate) {
    st = creditProgress(st, pos, st.lastAt + HEARTBEAT_SECONDS * 1000, LEN)
  }
  return st
}

// Watching the whole video in real time counts fully
assert.equal(watchedPct(play(0, LEN), LEN), 100)

// At double speed it still counts, which takes half the time
assert.equal(watchedPct(play(0, LEN, 2), LEN), 100)

// Faster than double speed (or a forged report) earns nothing
assert.equal(watchedPct(play(0, LEN, 4), LEN), 0)

// Skipping straight to the end earns nothing
let skip = creditProgress(newWatch(0), 10, 10_000, LEN)
skip = creditProgress(skip, 590, 20_000, LEN)
skip = creditProgress(skip, 600, 30_000, LEN)
assert.ok(watchedPct(skip, LEN) < 10, `${watchedPct(skip, LEN)}%`)

// Re-watching the same part does not add up; going back is not progress
let again = play(0, 300)
again = creditProgress(again, 0, again.lastAt + 1000, LEN)
again = play(0, 300, 1, again)
assert.equal(watchedPct(again, LEN), 50)

// Pausing is fine: time passing without progress earns nothing and loses nothing
let paused = play(0, 200)
paused = creditProgress(paused, 200, paused.lastAt + 600_000, LEN)
assert.equal(watchedPct(play(200, LEN, 1, paused), LEN), 100)

// A report beyond the end is capped at the video length; 89% is not enough
assert.equal(creditProgress(newWatch(0), 9999, 1e9, LEN).lastPos, LEN)
assert.ok(watchedPct(play(0, 530), LEN) < WATCHED_PCT)
assert.ok(watchedPct(play(0, 545), LEN) >= WATCHED_PCT)
assert.equal(watchedPct({ buckets: [1, 2] }, 0), 0)

console.log('video watch: ok')
