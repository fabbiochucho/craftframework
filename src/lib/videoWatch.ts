// Whether a learner really watched a training video, decided on the server. While the video plays the page reports
// the player position every HEARTBEAT_SECONDS; the server credits only progress that real time allows (no faster
// than MAX_RATE, so skipping ahead earns nothing) and counts the 5-second stretches covered against the video length
// stored with the module. A watch is recorded at WATCHED_PCT. Self-check: `node src/lib/videoWatch.test.ts`.

export const WATCHED_PCT = 90
export const HEARTBEAT_SECONDS = 10
const MAX_RATE = 2 // fastest playback speed credited
const SLACK = 3 // seconds of allowance for network and timer jitter
const BUCKET = 5

export interface WatchState { lastPos: number; lastAt: number; buckets: number[] }

export const newWatch = (at: number): WatchState => ({ lastPos: 0, lastAt: at, buckets: [] })

/** Applies one position report (seconds into the video) made at `at` (ms). Seeks and impossible jumps earn nothing. */
export function creditProgress(s: WatchState, pos: number, at: number, videoSeconds: number): WatchState {
  const p = Math.max(0, Math.min(pos, videoSeconds))
  const dp = p - s.lastPos
  const dt = Math.max(0, (at - s.lastAt) / 1000)
  let buckets = s.buckets
  if (dp > 0 && dp <= dt * MAX_RATE + SLACK) {
    const seen = new Set(buckets)
    for (let t = Math.floor(s.lastPos); t < Math.floor(p); t++) seen.add(Math.floor(t / BUCKET))
    buckets = [...seen].sort((x, y) => x - y)
  }
  return { lastPos: p, lastAt: at, buckets }
}

export function watchedPct(s: Pick<WatchState, 'buckets'>, videoSeconds: number): number {
  return videoSeconds > 0 ? Math.min(100, Math.floor(((s.buckets.length * BUCKET) / videoSeconds) * 100)) : 0
}
