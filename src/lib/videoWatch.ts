// How much of a training video has actually been played, from the embedded YouTube player's progress messages.
// Only seconds reached by normal playback count, so skipping to the end does not. A video counts as watched at
// WATCHED_PCT. Self-check: `node src/lib/videoWatch.test.ts`.

export const WATCHED_PCT = 90
const MAX_STEP = 3 // seconds between two progress messages during normal playback (up to 2x speed); more is a seek

export function createWatchTracker() {
  const seen = new Set<number>()
  let last: number | null = null
  let duration = 0
  return {
    /** Feed one progress report; returns the % of the video played so far. */
    update(currentTime: number, total?: number): number {
      if (total && total > 0) duration = total
      if (last !== null && currentTime > last && currentTime - last <= MAX_STEP) {
        for (let s = Math.floor(last); s < Math.floor(currentTime); s++) seen.add(s)
      }
      last = currentTime
      return this.pct()
    },
    pct(): number {
      return duration > 0 ? Math.min(100, Math.floor((seen.size / Math.floor(duration)) * 100)) : 0
    },
  }
}

/** The YouTube embed's progress message ({event: 'infoDelivery', info: {currentTime, duration}}), or null. */
export function playerProgress(data: unknown): { currentTime: number; duration?: number } | null {
  let msg: any = data
  if (typeof data === 'string') {
    try { msg = JSON.parse(data) } catch { return null }
  }
  const info = msg?.event === 'infoDelivery' || msg?.event === 'initialDelivery' ? msg.info : null
  if (!info || typeof info.currentTime !== 'number') return null
  return { currentTime: info.currentTime, ...(typeof info.duration === 'number' ? { duration: info.duration } : {}) }
}
