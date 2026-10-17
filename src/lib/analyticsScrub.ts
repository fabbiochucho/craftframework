// Decides what PostHog may send, and removes anything that could identify a person
// or carry content. Pure (no browser or PostHog imports) so it is unit-tested.
// Wired in as PostHog's `before_send`; returning null drops the event.
import { classifyPath, routePattern, type RouteClass } from './analyticsRoutes.ts'

export const SUPPORT_EVENTS = ['support_chat_message_sent', 'support_issue_created', 'support_escalated'] as const
const SUPPORT_PROPS = new Set(['token', 'distinct_id', 'classification', 'category', 'privacy_level', 'reason', 'recipient_type'])

const SLUG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,59}$/
const DIRECTORY_TYPES = new Set(['validators', 'firms', 'funders', 'organizations'])
type Check = (v: unknown) => boolean
// Funnel events and the only properties each may carry. Never free text, ids or query text.
const FUNNEL_SCHEMA: Record<string, Record<string, Check>> = {
  signed_up: {},
  onboarding_step_completed: { step: v => typeof v === 'string' && SLUG.test(v) },
  onboarding_completed: {},
  validator_profile_created: {},
  training_module_completed: { module: v => typeof v === 'string' && SLUG.test(v) },
  exam_started: {},
  exam_passed: {},
  exam_failed: {},
  engagement_created: {},
  directory_search: { type: v => typeof v === 'string' && DIRECTORY_TYPES.has(v), has_results: v => typeof v === 'boolean' },
}
export const FUNNEL_EVENTS = Object.keys(FUNNEL_SCHEMA)

// Events PostHog itself produces. Only these are ever allowed, and only on non-sensitive pages.
const PAGE_EVENTS = new Set(['$pageview', '$pageleave', '$autocapture', '$web_vitals', '$exception', '$$heatmap', '$identify', '$snapshot'])

export const PERSON_PROPS = ['role', 'country', 'language'] as const

const URL_KEYS = new Set([
  '$current_url', '$host', '$pathname', '$referrer', '$referring_domain', '$prev_pageview_pathname', '$prev_pageview_last_pathname',
  '$session_entry_url', '$session_entry_host', '$session_entry_pathname', '$session_entry_referrer', '$session_entry_referring_domain',
  '$title', 'title', '$heatmap_data', '$elements', '$elements_chain', '$el_text', '$external_click_url',
])
const CAMPAIGN_KEY = /^(\$initial_)?(utm_[a-z]+|gclid|gclsrc|dclid|fbclid|msclkid|wbraid|gbraid|ttclid|twclid|li_fat_id|igshid|mc_cid|mc_eid|rdt_cid|irclid|epik|\$?ph_?[a-z_]*campaign.*)$/i
const FREE_TEXT_KEYS = new Set(['$el_text', 'text', '$copy_text', '$selected_content', '$exception_source'])
const EMAIL = /[^\s@"'<>()[\],;:]+@[^\s@"'<>()[\],;:]+\.[A-Za-z]{2,}/g
const URL_IN_TEXT = /https?:\/\/[^\s"'<>)\]]+/g

/** Removes the query string and fragment. */
export function stripQuery(url: string): string {
  return url.replace(/[?#].*$/s, '')
}

/** A URL with no query/fragment, and its path reduced to the route pattern so ids never leave the browser. */
export function sanitizeUrl(url: string, usePattern = true): string {
  try {
    const u = new URL(url, 'https://placeholder.invalid')
    const relative = !/^[a-z][a-z0-9+.-]*:/i.test(url)
    const path = (usePattern && routePattern(u.pathname)) || u.pathname
    return relative ? path : `${u.origin}${path}`
  } catch {
    return stripQuery(url)
  }
}

export function sanitizeText(value: string): string {
  return value
    .replace(URL_IN_TEXT, m => stripQuery(m))
    .replace(/(^|[\s"'(])(\/[A-Za-z0-9_\-./%]*)\?[^\s"')]*/g, '$1$2')
    .replace(EMAIL, '[email]')
}

// Element chains carry visible text and attribute values; keep only structure (tag, class, id, position).
function sanitizeElementChain(chain: string): string {
  return chain
    .replace(/(?:^|(?<=[;:"]))text="(?:[^"\\]|\\.)*"/g, '')
    .replace(/attr__(?!class|id|type|role|data-attr)[\w-]+="(?:[^"\\]|\\.)*"/g, '')
}

function sanitizeValue(key: string, value: unknown, depth = 0): unknown {
  if (depth > 8) return undefined
  if (typeof value === 'string') {
    if (key === '$elements_chain') return sanitizeText(sanitizeElementChain(value))
    if (key === '$current_url' || key === '$pathname' || key === '$prev_pageview_pathname') return sanitizeUrl(value)
    return sanitizeText(value)
  }
  if (Array.isArray(value)) return value.map(v => sanitizeValue(key, v, depth + 1)).filter(v => v !== undefined)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FREE_TEXT_KEYS.has(k) || /^attr__(?!class$|id$|type$|role$)/.test(k) && k !== 'attr__class') continue
      const clean = sanitizeValue(k, v, depth + 1)
      if (clean !== undefined) out[k] = clean
    }
    return out
  }
  return value
}

// Heatmaps are keyed by page URL. Keep only trackable pages, keyed by route pattern.
function sanitizeHeatmap(data: unknown): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {}
  if (!data || typeof data !== 'object') return out
  for (const [url, items] of Object.entries(data as Record<string, unknown>)) {
    let path: string
    try { path = new URL(url, 'https://placeholder.invalid').pathname } catch { continue }
    if (classifyPath(path) === 'sensitive' || !Array.isArray(items)) continue
    const key = sanitizeUrl(url)
    out[key] = [...(out[key] ?? []), ...items]
  }
  return out
}

export interface ScrubOptions {
  /** Class of the page the event was produced on. */
  routeClass: RouteClass
}

/** Scrubs a property bag from a PostHog page event. */
export function scrubProperties(properties: Record<string, unknown>, { routeClass }: ScrubOptions): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (CAMPAIGN_KEY.test(key) || FREE_TEXT_KEYS.has(key)) continue
    // On a sensitive page nothing about the location may leave the browser.
    if (routeClass === 'sensitive' && (URL_KEYS.has(key) || /^\$initial_(current_url|referrer|referring_domain)/.test(key))) continue
    if (key === '$heatmap_data') { out[key] = sanitizeHeatmap(value); continue }
    if (key === '$title' || key === 'title') continue
    const clean = sanitizeValue(key, value)
    if (clean !== undefined) out[key] = clean
  }
  return out
}

function checkedPersonProps(set: unknown): Record<string, string> | undefined {
  if (!set || typeof set !== 'object') return undefined
  const out: Record<string, string> = {}
  for (const key of PERSON_PROPS) {
    const v = (set as Record<string, unknown>)[key]
    if (typeof v === 'string' && /^[\p{L}\p{N} _.'()-]{1,60}$/u.test(v) && !v.includes('@')) out[key] = v
  }
  return Object.keys(out).length ? out : undefined
}

export interface CaptureEvent { event: string; properties: Record<string, unknown>; $set?: Record<string, unknown>; $set_once?: Record<string, unknown> }
export interface EventContext {
  analytics: boolean
  replay: boolean
  /** The visitor separately opted in to anonymous support-chat events. */
  support: boolean
  pathname: string
}

/** PostHog `before_send`: returns the event to send (scrubbed) or null to drop it. */
export function filterEvent(event: CaptureEvent | null, ctx: EventContext): CaptureEvent | null {
  if (!event || typeof event.event !== 'string') return null
  const routeClass = classifyPath(ctx.pathname)
  const properties = event.properties ?? {}

  if ((SUPPORT_EVENTS as readonly string[]).includes(event.event)) {
    if (!ctx.support || routeClass === 'sensitive') return null
    const kept = Object.fromEntries(Object.entries(properties).filter(([k]) => SUPPORT_PROPS.has(k)))
    return { event: event.event, properties: { ...kept, $process_person_profile: false } }
  }
  if (!ctx.analytics) return null

  const schema = FUNNEL_SCHEMA[event.event]
  if (schema) {
    // Funnel events are content-free milestones, so they are also sent from sensitive pages (for example
    // creating an engagement) - but with no location and only the schema's validated properties.
    const system = scrubProperties(properties, { routeClass })
    const custom: Record<string, unknown> = {}
    for (const [k, check] of Object.entries(schema)) if (k in properties && check(properties[k])) custom[k] = properties[k]
    for (const k of Object.keys(system)) if (!k.startsWith('$') && k !== 'token' && k !== 'distinct_id') delete system[k]
    return { event: event.event, properties: { ...system, ...custom } }
  }

  if (!PAGE_EVENTS.has(event.event) || routeClass === 'sensitive') return null
  if (event.event === '$snapshot' && !ctx.replay) return null
  if (event.event === '$snapshot') return event
  const next: CaptureEvent = { event: event.event, properties: scrubProperties(properties, { routeClass }) }
  if (event.event === '$identify') {
    const set = checkedPersonProps(event.$set ?? properties.$set)
    if (set) next.$set = set
    delete next.properties.$set
  }
  delete next.properties.$set_once
  return next
}
