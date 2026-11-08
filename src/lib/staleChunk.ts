// After a deploy, a tab opened on the previous version asks for code files that no longer exist
// ("Failed to fetch dynamically imported module"). Reload once so it picks up the new version; a one-minute
// guard (per tab) stops a reload loop if the files are missing for another reason, and then the error is reported.
const KEY = 'craft:stale-chunk-reload'
const GUARD_MS = 60_000

// Set once this tab has decided to reload. Errors raised in between are consequences of the old code (for
// example the router reading a module Vite resolved as empty after we cancelled its error), so monitoring drops them.
let reloading = false
export const isReloadingForStaleChunk = () => reloading

export function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(msg)
}

/** Reloads the page for a stale-chunk error, at most once a minute. Returns true when it reloads. */
export function reloadForStaleChunk(
  err: unknown,
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = typeof sessionStorage === 'undefined' ? undefined : sessionStorage,
  reload: () => void = () => window.location.reload(),
  now = Date.now(),
): boolean {
  if (!storage || !isStaleChunkError(err)) return false
  try {
    const last = Number(storage.getItem(KEY))
    if (last && now - last < GUARD_MS) return false
    storage.setItem(KEY, String(now))
  } catch {
    return false
  }
  reloading = true
  reload()
  return true
}

/** Listens for Vite's preload failures and unhandled stale-chunk rejections. Safe to call more than once. */
let installed = false
export function installStaleChunkReload() {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('vite:preloadError', (e) => { if (reloadForStaleChunk((e as Event & { payload?: unknown }).payload)) e.preventDefault() })
  window.addEventListener('unhandledrejection', (e) => { if (reloadForStaleChunk(e.reason)) e.preventDefault() })
}
