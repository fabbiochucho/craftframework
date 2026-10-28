// Browser error monitoring (Sentry, EU region). Errors and a low-rate performance trace only - no session
// replay, feedback widget or profiling, and no personal data: everything is scrubbed in errorScrub.ts before it
// leaves the browser. It runs as legitimate interest and is separate from the analytics consent flow.
//
// With no DSN (local dev, tests, builds without the variable) nothing is imported or sent. The SDK is loaded
// with a dynamic import after the first paint so it never competes with the app's first render.
import buildInfo from './build-info.json'
import { IGNORE_ERRORS, NO_DATA_COLLECTION, isExpectedError, isSensitivePath, parameterizePath, scrubBreadcrumb, scrubEvent } from './errorScrub'

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined

export const monitoringConfigured = Boolean(DSN)

type Sentry = typeof import('./sentryBrowser')
let sdk: Promise<Sentry | null> | null = null

const sensitiveRoute = () => typeof window === 'undefined' || isSensitivePath(window.location.pathname)

function load(): Promise<Sentry | null> {
  if (!DSN || typeof window === 'undefined') return Promise.resolve(null)
  sdk ??= import('./sentryBrowser')
    .then(Sentry => {
      Sentry.init({
        dsn: DSN,
        environment: buildInfo.environment ?? undefined,
        release: buildInfo.release ?? undefined,
        // No personal data by design (Sentry v11's replacement for sendDefaultPii: false).
        dataCollection: NO_DATA_COLLECTION,
        // Errors plus 5% performance traces. No replay, profiling or feedback integrations are bundled.
        tracesSampleRate: 0.05,
        // Whole transactions (not streamed spans), so beforeSendTransaction below sees and scrubs every one.
        traceLifecycle: 'static',
        tracePropagationTargets: [],
        ignoreErrors: IGNORE_ERRORS,
        denyUrls: [/^chrome-extension:/i, /^moz-extension:/i, /^safari-(web-)?extension:/i, /extensions\//i],
        maxBreadcrumbs: 30,
        // Defaults minus release-health sessions (which would report every visit); plus route tracing.
        integrations: defaults => [
          ...defaults.filter(i => i.name !== 'BrowserSession'),
          Sentry.browserTracingIntegration({ instrumentPageLoad: true, instrumentNavigation: true, enableInp: false, enableLongTask: false, enableLongAnimationFrame: false, beforeStartSpan: options => ({ ...options, name: parameterizePath(options.name) }) }),
        ],
        beforeBreadcrumb: crumb => scrubBreadcrumb(crumb, { sensitiveRoute: sensitiveRoute() }),
        beforeSend: (event, hint) => (isExpectedError(hint?.originalException) ? null : scrubEvent(event, { sensitiveRoute: sensitiveRoute() })),
        beforeSendTransaction: event => scrubEvent(event, { sensitiveRoute: sensitiveRoute() }),
      })
      return Sentry
    })
    .catch(() => null)
  return sdk
}

/** Starts monitoring after the first paint. Safe to call more than once; a no-op without a DSN. */
export function initMonitoring() {
  if (!DSN || typeof window === 'undefined') return
  const start = () => { void load() }
  const idle = (window as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
  const afterLoad = () => (idle ? idle(start, { timeout: 4000 }) : window.setTimeout(start, 1500))
  if (document.readyState === 'complete') afterLoad()
  else window.addEventListener('load', afterLoad, { once: true })
}

/** Reports an error caught by the root error boundary. Resolves once handed to the SDK; never throws. */
export async function captureRenderError(error: unknown): Promise<void> {
  try {
    const Sentry = await load()
    Sentry?.captureException(error, { tags: { handled: 'false', mechanism: 'react.errorboundary' } })
  } catch { /* monitoring must never break the app */ }
}

/** Reports a problem the page handled itself (for example a third-party player that failed to load). Never throws. */
export async function captureHandledError(error: unknown, area: string): Promise<void> {
  try {
    const Sentry = await load()
    Sentry?.captureException(error, { tags: { handled: 'true', area } })
  } catch { /* monitoring must never break the app */ }
}

/** Super Admin test: sends one labelled error. Resolves false when monitoring is not configured. */
export async function sendBrowserTestError(): Promise<boolean> {
  const Sentry = await load()
  if (!Sentry) return false
  Sentry.captureException(new Error('Sentry browser test error (deliberate, sent by a Super Admin)'))
  return true
}
