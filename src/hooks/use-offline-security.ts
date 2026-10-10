// ============================================================================
// CRAFT v4.0 — 3-Layer Sovereignty Shield: local auto-wipe
// ----------------------------------------------------------------------------
// Local storage is a temporary, highly-secured buffer for fiduciary and
// regulatory data — never a resting place. This hook enforces the inactivity
// layer of the shield: after 15 minutes with no user activity it purges the
// entire on-device buffer (offlineDB.clearAll) and sends the user back to the
// login screen with ?reason=session_timeout so the UI can explain what happened.
//
// Activity is any of mousedown / keydown / scroll (plus touch for field tablets
// and phones). Every event resets the countdown. Listeners are passive and the
// timer is a single debounced timeout, so this is effectively free at runtime.
// ============================================================================

import { useEffect, useRef } from 'react'
import { clearOfflineSession } from '../lib/offline/session'

const FIFTEEN_MINUTES = 15 * 60 * 1000

export interface OfflineSecurityOptions {
  /** Inactivity window before wipe. Defaults to 15 minutes. */
  timeoutMs?: number
  /** Where to send the user after a wipe. */
  redirectTo?: string
  /** Optional app-level cleanup (e.g. context logout) run before redirect. */
  onWipe?: () => void | Promise<void>
  /** Set false to temporarily disable (e.g. on public/marketing routes). */
  enabled?: boolean
}

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'pointerdown',
  'mousemove',
  'click',
]

export function useOfflineSecurity(options: OfflineSecurityOptions = {}): void {
  const {
    timeoutMs = FIFTEEN_MINUTES,
    redirectTo = '/auth?reason=session_timeout',
    onWipe,
    enabled = true,
  } = options

  // Keep the latest callback without re-subscribing listeners on every render.
  const onWipeRef = useRef(onWipe)
  onWipeRef.current = onWipe

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    let timer: ReturnType<typeof setTimeout>
    let wiped = false
    let deadline = Date.now() + timeoutMs

    const wipe = async () => {
      if (wiped) return
      wiped = true
      try {
        await clearOfflineSession()
      } catch (err) {
        console.error('[security] auto-wipe failed', err)
      }
      try {
        await onWipeRef.current?.()
      } catch (err) {
        console.error('[security] onWipe callback failed', err)
      }
      // Full-document navigation guarantees all in-memory state is torn down too.
      window.location.assign(redirectTo)
    }

    const reset = () => {
      clearTimeout(timer)
      if (Date.now() >= deadline) {
        void wipe()
        return
      }
      deadline = Date.now() + timeoutMs
      timer = setTimeout(() => void wipe(), timeoutMs)
    }

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, reset, { passive: true })
    }
    // Wipe sooner if the tab is hidden past the window (backgrounded device).
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() >= deadline) void wipe()
    }
    document.addEventListener('visibilitychange', onVisibility)

    reset()

    return () => {
      clearTimeout(timer)
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, reset)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, timeoutMs, redirectTo])
}
