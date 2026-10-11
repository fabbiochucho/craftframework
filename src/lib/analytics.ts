// posthog-js's no-external build ships ESM that the Netlify Functions (Lambda)
// runtime can't load when it's pulled statically into the server bundle - and
// since SupportBot (the only importer of this module) is rendered from
// __root.tsx, a top-level `import posthog from '...'` here crashed SSR on
// every single route. This is purely a client-side library, so it's loaded
// dynamically, only from inside the `typeof window !== 'undefined'` guards
// below, which keeps it out of the server bundle entirely.
type PostHogModule = typeof import('posthog-js/dist/module.no-external')
let posthogPromise: Promise<PostHogModule['default']> | null = null
function loadPosthog(): Promise<PostHogModule['default']> {
  posthogPromise ??= import('posthog-js/dist/module.no-external').then(m => m.default)
  return posthogPromise
}

type Category = 'bug' | 'feature' | 'question'
type SupportEvent =
  | { event: 'support_chat_message_sent'; classification: Category }
  | { event: 'support_issue_created'; category: Category; privacy_level: 'public' }
  | { event: 'support_escalated'; reason: 'private_report' | 'unresolved_question' | 'human_requested'; recipient_type: 'confidential' | 'support_queue' }

let consent = false
let initialized = false

function sensitiveRoute() {
  return window.location.pathname.startsWith('/app') || window.location.pathname.startsWith('/assessment')
}

export async function setSupportAnalyticsConsent(enabled: boolean, key?: string) {
  consent = enabled
  if (typeof window === 'undefined') return
  if (enabled && sensitiveRoute()) return
  if (enabled && key && !initialized) {
    const posthog = await loadPosthog()
    posthog.init(key, {
      api_host: 'https://eu.i.posthog.com',
      persistence: 'memory',
      request_batching: false,
      disable_compression: true,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      person_profiles: 'never',
      advanced_disable_feature_flags: true,
      opt_out_capturing_by_default: true,
      before_send: event => {
        if (!event || !consent || sensitiveRoute() || !['support_chat_message_sent', 'support_issue_created', 'support_escalated'].includes(event.event)) return null
        const allowed = ['token', 'distinct_id', 'classification', 'category', 'privacy_level', 'reason', 'recipient_type']
        event.properties = Object.fromEntries(Object.entries(event.properties).filter(([key]) => allowed.includes(key)))
        event.properties.$process_person_profile = false
        return event
      },
    })
    initialized = true
  }
  if (initialized) {
    const posthog = await loadPosthog()
    if (enabled) posthog.opt_in_capturing({ captureEventName: false })
    else posthog.opt_out_capturing()
  }
}

export async function trackSupportEvent({ event, ...properties }: SupportEvent) {
  if (!consent || !initialized || typeof window === 'undefined') return
  // Workspace pages can contain confidential assessment and evidence data.
  if (sensitiveRoute()) return
  try {
    const posthog = await loadPosthog()
    posthog.capture(event, properties)
  } catch {
    // Analytics must never interrupt support intake.
  }
}
