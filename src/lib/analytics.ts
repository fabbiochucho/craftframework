import posthog from 'posthog-js/dist/module.no-external'

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

export function setSupportAnalyticsConsent(enabled: boolean, key?: string) {
  consent = enabled
  if (typeof window === 'undefined') return
  if (enabled && sensitiveRoute()) return
  if (enabled && key && !initialized) {
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
    if (enabled) posthog.opt_in_capturing({ captureEventName: false })
    else posthog.opt_out_capturing()
  }
}

export function trackSupportEvent({ event, ...properties }: SupportEvent) {
  if (!consent || !initialized || typeof window === 'undefined') return
  // Workspace pages can contain confidential assessment and evidence data.
  if (sensitiveRoute()) return
  try {
    posthog.capture(event, properties)
  } catch {
    // Analytics must never interrupt support intake.
  }
}
