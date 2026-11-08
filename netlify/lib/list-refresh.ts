// Refreshes the sanctions lists that are due, retrying failures a few minutes apart (official list servers have
// short outages). A list that still fails keeps its previous copy: that is a warning while the copy is under three
// days old, and an error (reported to Sentry) once it is older or there is no copy at all.
export const RETRY_DELAYS_MS = [3 * 60_000, 3 * 60_000]
export const STALE_ALERT_MS = 3 * 86_400_000
const DUE_AFTER_MS = 6 * 3_600_000

type Deps<S extends string> = {
  fetchedAt: (s: S) => Promise<string | null>
  refresh: (s: S) => Promise<number>
  log: { info: (m: string) => void; warn: (m: string, err: unknown) => void; error: (m: string, err: unknown) => void }
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

export async function refreshDueLists<S extends string>(sources: readonly S[], d: Deps<S>): Promise<{ refreshed: S[]; failed: S[] }> {
  const now = d.now ?? Date.now
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  let pending: { source: S; at: string | null }[] = []
  for (const source of sources) {
    const at = await d.fetchedAt(source)
    if (at && now() - Date.parse(at) < DUE_AFTER_MS) continue
    pending.push({ source, at })
  }
  const refreshed: S[] = []
  for (let attempt = 0; pending.length; attempt++) {
    const failed: { source: S; at: string | null; err: unknown }[] = []
    for (const p of pending) {
      try {
        const n = await d.refresh(p.source)
        refreshed.push(p.source)
        d.log.info(`${p.source}: ${n} entries`)
      } catch (err) {
        failed.push({ ...p, err })
      }
    }
    if (!failed.length) break
    if (attempt >= RETRY_DELAYS_MS.length) {
      for (const f of failed) {
        const ageMs = f.at ? now() - Date.parse(f.at) : Infinity
        const msg = `${f.source} refresh failed after ${attempt + 1} attempts; ${f.at ? `keeping the copy from ${f.at}` : 'no previous copy'}`
        if (ageMs < STALE_ALERT_MS) d.log.warn(msg, f.err)
        else d.log.error(msg, f.err)
      }
      return { refreshed, failed: failed.map((f) => f.source) }
    }
    await sleep(RETRY_DELAYS_MS[attempt])
    pending = failed
  }
  return { refreshed, failed: [] }
}
