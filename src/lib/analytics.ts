// Consented behaviour analytics (PostHog, EU) plus the opt-in support-chat events.
//
// posthog-js's no-external builds ship ESM that the Netlify Functions (Lambda)
// runtime can't load when pulled statically into the server bundle - a top-level
// import here once crashed SSR on every route. This is purely client-side, so it
// is loaded dynamically, only from inside `typeof window !== 'undefined'` paths,
// and only after the visitor has consented. The "full" build bundles the session
// recorder, web vitals and error capture so nothing else is fetched at runtime
// (the site's CSP does not allow third-party scripts).
//
// What may be sent is decided in analyticsScrub.ts (`filterEvent`), which runs as
// PostHog's before_send; the page classification is in analyticsRoutes.ts.
import { classifyPath } from './analyticsRoutes'
import { filterEvent, FUNNEL_EVENTS, type CaptureEvent } from './analyticsScrub'
import { getConsentSnapshot, subscribeConsent } from './consent'

type PostHogModule = typeof import('posthog-js/dist/module.full.no-external')
type PostHog = PostHogModule['default']
let posthogPromise: Promise<PostHog> | null = null
// Set once loaded, so route changes can stop recording synchronously.
let loaded: PostHog | null = null
function loadPosthog(): Promise<PostHog> {
  posthogPromise ??= import('posthog-js/dist/module.full.no-external').then(m => (loaded = m.default))
  return posthogPromise
}

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const ID_SALT = (import.meta.env.VITE_POSTHOG_ID_SALT as string | undefined) || 'craft-analytics-v1'

export const analyticsConfigured = Boolean(POSTHOG_KEY)

type Category = 'bug' | 'feature' | 'question'
type SupportEvent =
  | { event: 'support_chat_message_sent'; classification: Category }
  | { event: 'support_issue_created'; category: Category; privacy_level: 'public' }
  | { event: 'support_escalated'; reason: 'private_report' | 'unresolved_question' | 'human_requested'; recipient_type: 'confidential' | 'support_queue' }

/** Content-free funnel milestones. Properties are validated again in analyticsScrub.ts. */
export type FunnelEvent =
  | { event: 'signed_up' }
  | { event: 'onboarding_step_completed'; step: string }
  | { event: 'onboarding_completed' }
  | { event: 'validator_profile_created' }
  | { event: 'training_module_completed'; module: string }
  | { event: 'exam_started' }
  | { event: 'exam_passed' }
  | { event: 'exam_failed' }
  | { event: 'engagement_created' }
  | { event: 'directory_search'; type: 'validators' | 'firms' | 'funders' | 'organizations'; has_results: boolean }

let supportConsent = false
let initialized = false
let initializedPersistence: 'memory' | 'localStorage' = 'memory'
let pageviewPath: string | null = null
let recording = false
let identifiedHash: string | null = null
let identity: { id?: string; role?: string; country?: string; language?: string } = {}
// Consent changes are applied in order; tracking waits for the pending one so
// the first event after opting in isn't dropped while posthog-js still loads.
let ready: Promise<void> = Promise.resolve()

const stripPath = (p: string) => p.split(/[?#]/)[0]
const pathname = () => (typeof window === 'undefined' ? '/' : window.location.pathname)

function eventContext() {
  const c = getConsentSnapshot()
  return { analytics: c.analytics, replay: c.replay, support: supportConsent && !c.signal, pathname: pathname() }
}

const wantCapture = () => analyticsConfigured && (getConsentSnapshot().analytics || (supportConsent && !getConsentSnapshot().signal))

/** Support-chat opt-in (a separate, narrower choice than the analytics banner). Ignored when DNT/GPC is on. */
export function setSupportAnalyticsConsent(enabled: boolean, _key?: string): Promise<void> {
  supportConsent = enabled && !getConsentSnapshot().signal
  return reconcile()
}

function reconcile(): Promise<void> {
  if (typeof window === 'undefined') return ready
  ready = ready.then(applyConsent).catch(() => {})
  return ready
}

function clearStoredPosthog() {
  try {
    for (const k of Object.keys(window.localStorage)) if (k.startsWith('ph_') || k.startsWith('__ph_')) window.localStorage.removeItem(k)
    for (const k of Object.keys(window.sessionStorage)) if (k.startsWith('ph_') || k.startsWith('__ph_')) window.sessionStorage.removeItem(k)
  } catch { /* storage unavailable */ }
}

async function applyConsent() {
  const consent = getConsentSnapshot()
  if (!wantCapture()) {
    // Withdrawal (or nothing granted): stop, forget the identifier, and never load the library just to switch it off.
    if (initialized) {
      const posthog = await loadPosthog()
      posthog.stopSessionRecording()
      posthog.opt_out_capturing()
      posthog.reset()
      // PostHog re-saves its state when a page unloads; switch persistence off so nothing is written back.
      posthog.set_config({ disable_persistence: true })
      clearStoredPosthog()
    }
    recording = false; pageviewPath = null; identifiedHash = null
    return
  }
  const persistence = consent.analytics ? 'localStorage' : 'memory'
  const posthog = await loadPosthog()
  if (!initialized) {
    posthog.init(POSTHOG_KEY!, {
      api_host: 'https://eu.i.posthog.com',
      // Events are queued in memory until opt-in; the identifier lives in local storage only with analytics consent. No cookies.
      persistence,
      request_batching: false,
      disable_compression: true,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_heatmaps: false,
      capture_dead_clicks: false,
      capture_exceptions: false,
      capture_performance: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_external_dependency_loading: true,
      // Feature flags and surveys stay off. With analytics consent the remote-config call is kept: it is how the
      // PostHog project's own switches (session replay, heatmaps, error and web-vitals capture) apply, so each can
      // be turned off centrally. Support-chat-only mode makes no such call. A visitor who adds analytics later gets
      // these project switches from their next page load.
      advanced_disable_flags: !consent.analytics,
      advanced_disable_feature_flags: true,
      person_profiles: 'identified_only',
      respect_dnt: true,
      save_campaign_params: false,
      save_referrer: false,
      mask_all_text: true,
      mask_all_element_attributes: true,
      mask_personal_data_properties: true,
      opt_out_capturing_by_default: true,
      session_recording: {
        maskAllInputs: true,
        // All text is masked except on public marketing pages (evaluated when the text is recorded).
        maskTextSelector: '*',
        maskTextFn: (text: string) => (classifyPath(pathname()) === 'marketing' ? text : text.replace(/\S/g, '*')),
        maskAllElementAttributes: true,
        blockSelector: 'canvas, video, iframe, img[src^="blob:"], img[src^="data:"], img[src*="/api/"], [data-ph-block]',
        recordHeaders: false,
        recordBody: false,
        // The site's CSP has no blob: workers, so compress on the main thread instead.
        compress_events: false,
      },
      before_send: event => filterEvent(event as CaptureEvent | null, eventContext()) as never,
    })
    initialized = true
    initializedPersistence = persistence
  } else if (persistence !== initializedPersistence) {
    posthog.set_config({ persistence })
    initializedPersistence = persistence
  }
  posthog.set_config({ disable_persistence: false })
  posthog.opt_in_capturing({ captureEventName: false })
  if (consent.analytics) {
    posthog.set_config({
      autocapture: { dom_event_allowlist: ['click', 'submit'], element_allowlist: ['a', 'button', 'form', 'input', 'select', 'textarea'], capture_copied_text: false },
      capture_heatmaps: true,
      capture_exceptions: { capture_unhandled_errors: true, capture_unhandled_rejections: true, capture_console_errors: false },
      capture_performance: { network_timing: false, web_vitals: true },
    })
  } else {
    posthog.set_config({ autocapture: false, capture_heatmaps: false, capture_exceptions: false, capture_performance: false })
  }
  syncRoute(posthog)
}

// ---- Route awareness ----------------------------------------------------------------------

function stopRecording(posthog: PostHog) {
  if (recording) { posthog.stopSessionRecording(); recording = false }
}

function syncRoute(posthog: PostHog) {
  const consent = getConsentSnapshot()
  const path = pathname()
  if (!consent.analytics || classifyPath(path) === 'sensitive') { stopRecording(posthog); return }
  if (pageviewPath !== stripPath(path)) {
    pageviewPath = stripPath(path)
    posthog.capture('$pageview')
  }
  if (consent.replay && !recording) { posthog.startSessionRecording(); recording = true }
  if (!consent.replay) stopRecording(posthog)
  void syncIdentity(posthog)
}

/** Router hook: runs before the destination renders, so recording stops before a sensitive page is drawn. */
export function analyticsBeforeNavigate(to: string) {
  if (typeof window === 'undefined' || !initialized || !loaded) return
  const leaving = pathname()
  if (classifyPath(to) === 'sensitive') stopRecording(loaded)
  if (getConsentSnapshot().analytics && classifyPath(leaving) !== 'sensitive' && stripPath(leaving) !== stripPath(to)) loaded.capture('$pageleave')
}

/** Router hook: a navigation finished. */
export function analyticsRouteResolved() {
  if (typeof window === 'undefined' || !initialized) return
  ready = ready.then(async () => { if (initialized) syncRoute(await loadPosthog()) }).catch(() => {})
}

// ---- Identity -----------------------------------------------------------------------------

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${ID_SALT}:${value}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

async function syncIdentity(posthog: PostHog) {
  try {
    if (!getConsentSnapshot().analytics) return
    if (!identity.id) {
      if (identifiedHash) { posthog.reset(); posthog.opt_in_capturing({ captureEventName: false }); identifiedHash = null; pageviewPath = null }
      return
    }
    if (classifyPath(pathname()) === 'sensitive') return
    const hash = await sha256Hex(identity.id)
    if (hash === identifiedHash) return
    identifiedHash = hash
    // Only these three properties; never an email, name or organisation.
    posthog.identify(hash, { role: identity.role, country: identity.country, language: identity.language })
  } catch { /* identity is best-effort */ }
}

/** The Netlify Identity user id (never the email), set on sign-in and cleared on sign-out. It is hashed before it leaves the browser. */
export function setAnalyticsUserId(id: string | null | undefined) {
  if ((identity.id ?? null) === (id ?? null)) return
  identity = { ...identity, id: id || undefined }
  analyticsRouteResolved()
}

/** Role, country and language - the only person properties ever sent. */
export function setAnalyticsTraits(traits: { role?: string; country?: string; language?: string }) {
  if (identity.role === traits.role && identity.country === traits.country && identity.language === traits.language) return
  identity = { ...identity, ...traits }
  // Re-identify with the new traits.
  identifiedHash = null
  analyticsRouteResolved()
}

// ---- Events -------------------------------------------------------------------------------

/** Funnel milestone. A no-op unless the visitor consented to analytics. */
export async function trackEvent({ event, ...properties }: FunnelEvent) {
  if (typeof window === 'undefined' || !analyticsConfigured || !getConsentSnapshot().analytics || !FUNNEL_EVENTS.includes(event)) return
  try {
    await ready
    if (!getConsentSnapshot().analytics || !initialized) return
    const posthog = await loadPosthog()
    posthog.capture(event, properties)
  } catch {
    // Analytics must never interrupt the product.
  }
}

export async function trackSupportEvent({ event, ...properties }: SupportEvent) {
  if (!supportConsent || typeof window === 'undefined') return
  // Workspace pages can contain confidential assessment and evidence data.
  if (classifyPath(pathname()) === 'sensitive') return
  try {
    await ready
    if (!supportConsent || !initialized) return
    const posthog = await loadPosthog()
    posthog.capture(event, properties)
  } catch {
    // Analytics must never interrupt support intake.
  }
}

let started = false
/** Starts listening for consent changes (banner choices, withdrawal, policy-version re-ask). Idempotent; client only. */
export function initAnalytics() {
  if (started || typeof window === 'undefined') return
  started = true
  const key = () => { const c = getConsentSnapshot(); return `${c.analytics}|${c.replay}|${c.signal}` }
  let last = key()
  subscribeConsent(() => {
    const next = key()
    if (next === last) return
    last = next
    if (getConsentSnapshot().signal) supportConsent = false
    void reconcile()
  })
  // A returning visitor who already consented.
  if (getConsentSnapshot().analytics) void reconcile()
}
