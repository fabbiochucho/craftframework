// Server-side error monitoring (Sentry, EU region) for the Netlify Functions. Errors only, no personal data:
// events are scrubbed by src/lib/errorScrub.ts (shared with the browser) before they leave the function.
//
// With no SENTRY_DSN (local dev, tests, previews without the variable) every export is a no-op and
// @sentry/node is never even imported. Sentry can fail, be slow or be blocked without affecting a response:
// nothing here throws, and the flush before returning is time-boxed.
import buildInfo from '../../src/lib/build-info.json' with { type: 'json' }
import { NO_DATA_COLLECTION, environmentFromContext, isExpectedError, scrubBreadcrumb, scrubEvent } from '../../src/lib/errorScrub.ts'

type Sentry = typeof import('@sentry/node')
type Transport = NonNullable<Parameters<Sentry['init']>[0]>['transport']

const FLUSH_MS = 2000
let sdk: Promise<Sentry | null> | null = null
let testTransport: Transport | undefined
const pending = new Set<Promise<unknown>>()

const dsn = () => process.env.SENTRY_DSN?.trim() || undefined

/** Test hook: sends events to this transport instead of the network, and forgets any earlier initialisation. */
export function useTransportForTests(transport: Transport | undefined) {
  testTransport = transport
  void sdk?.then(Sentry => Sentry?.close(0)).catch(() => {})
  sdk = null
}

function load(): Promise<Sentry | null> {
  const key = dsn()
  if (!key) return Promise.resolve(null)
  sdk ??= import('@sentry/node')
    .then(Sentry => {
      const scrubCtx = { sensitiveRoute: true }
      Sentry.init({
        dsn: key,
        environment: environmentFromContext(process.env.CONTEXT) ?? buildInfo.environment ?? undefined,
        release: process.env.COMMIT_REF || buildInfo.release || undefined,
        // Sentry v11's replacement for sendDefaultPii: false - every data category off.
        dataCollection: NO_DATA_COLLECTION,
        // Error monitoring only: no OpenTelemetry, no module-patching hooks, no performance spans, and only the
        // integrations that group errors.
        enableOpenTelemetrySetup: false,
        enableRuntimeChannelInjection: false,
        defaultIntegrations: false,
        integrations: [Sentry.eventFiltersIntegration(), Sentry.functionToStringIntegration(), Sentry.linkedErrorsIntegration(), Sentry.dedupeIntegration()],
        traceLifecycle: 'static',
        maxBreadcrumbs: 0,
        beforeBreadcrumb: crumb => scrubBreadcrumb(crumb, scrubCtx),
        beforeSend: (event, hint) => (isExpectedError(hint?.originalException) ? null : scrubEvent(event, scrubCtx)),
        beforeSendTransaction: event => scrubEvent(event, scrubCtx),
        ...(testTransport ? { transport: testTransport } : {}),
      })
      return Sentry
    })
    .catch(() => null)
  return sdk
}

/**
 * Reports an unexpected server error. Fire-and-forget: the work is tracked so `flushMonitoring` can wait for it
 * before the function returns. Expected client errors (4xx, validation) are never reported.
 */
export function reportError(scope: string, err: unknown, message?: string) {
  if (!dsn() || isExpectedError(err)) return
  const work = load()
    .then(Sentry => {
      if (!Sentry) return
      const error = err instanceof Error ? err : new Error(`${scope}: ${message ?? 'non-Error value thrown'}`)
      Sentry.withScope(s => {
        s.setTag('scope', scope)
        s.setTag('runtime', 'netlify-function')
        Sentry.captureException(error)
      })
    })
    .catch(() => {})
  pending.add(work)
  void work.finally(() => pending.delete(work))
}

/** Waits (at most a couple of seconds) for queued reports to leave the function. Lambda freezes when the response returns. */
export async function flushMonitoring(timeoutMs = FLUSH_MS): Promise<void> {
  if (!dsn()) return
  try {
    const flush = (async () => {
      await Promise.allSettled([...pending])
      const Sentry = await load()
      await Sentry?.flush(timeoutMs)
    })()
    let timer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([flush, new Promise<void>(resolve => { timer = setTimeout(resolve, timeoutMs + 250) })])
    clearTimeout(timer)
  } catch { /* monitoring never affects a response */ }
}

/**
 * Wraps a Netlify Function handler: an exception that escapes it is reported once and re-thrown unchanged, and
 * everything reported while it ran (including via `logger.error`) is flushed before the response goes out.
 */
export function monitored<A extends unknown[], R>(handler: (...args: A) => R | Promise<R>): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try {
      return await handler(...args)
    } catch (err) {
      reportError('uncaught', err)
      throw err
    } finally {
      await flushMonitoring()
    }
  }
}
