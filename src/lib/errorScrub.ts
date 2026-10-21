// Decides what error monitoring (Sentry) may send. Pure - no Sentry, browser or Node imports - so it is unit-tested
// and shared by the browser SDK and the Netlify Functions. The rule: an event describes WHERE something broke
// (stack, route pattern, browser, release), never WHO or WITH WHAT DATA. Anything that could carry a person or
// content (user, request body/cookies/headers, query strings, extra data, free text) is removed or redacted.
import { classifyPath, routePatternAny } from './analyticsRoutes.ts'

const MAX_TEXT = 500
const EMAIL = /[^\s@"'<>()[\],;:/\\]+@[^\s@"'<>()[\],;:]+\.[A-Za-z]{2,}/g
const URL_IN_TEXT = /\bhttps?:\/\/[^\s"'<>)\]]+/g
// A path-looking token in free text, optionally with a query string / fragment.
const PATH_IN_TEXT = /(^|[\s"'(=])(\/(?:api|app|admin|accept|validation|verify)(?:\/[^\s"'?#)]*)?)(?:[?#][^\s"')]*)?/g
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
const JWT = /\beyJ[\w-]{8,}\.[\w-]{8,}(?:\.[\w-]*)?/g
const LONG_TOKEN = /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{24,}\b/g
const DIGIT_RUN = /\d{5,}/g
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi
// Postgres/Drizzle put the offending VALUES in messages: "Key (name)=(Acme Ltd)" and "params: a,b,c".
const PG_KEY = /\(([^()]*)\)=\((.*?)\)/g
// Double-quoted text in a message is almost always a value (JSON parse errors, "Acme" not found, constraint names).
const QUOTED = /"[^"\n]+"/g
const PARAMS = /\bparams:.*$/gis

export function stripQuery(url: string): string {
  return url.replace(/[?#].*$/s, '')
}

const ID_LIKE = (segment: string) => /\d/.test(segment) || /[@%]/.test(segment) || segment.length > 24
const stripSlashes = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path)

/** A path as its route pattern (`/engagements/$id`); unknown paths have every id-like segment replaced by `:id`. */
export function parameterizePath(pathname: string): string {
  const path = stripSlashes(stripQuery(pathname) || '/')
  const known = routePatternAny(path)
  if (known) return known
  return path.split('/').map(s => (s && ID_LIKE(s) ? ':id' : s)).join('/') || '/'
}

/** A URL with no query/fragment/credentials and a parameterised path. */
export function sanitizeUrl(url: string): string {
  try {
    const relative = !/^[a-z][a-z0-9+.-]*:/i.test(url)
    const u = new URL(url, 'https://placeholder.invalid')
    const path = parameterizePath(u.pathname)
    return relative ? path : `${u.origin}${path}`
  } catch {
    return parameterizePath(stripQuery(url))
  }
}

/** Redacts emails, long digit runs, tokens and data values from free text (messages, breadcrumbs). */
export function scrubText(value: string): string {
  return value
    .replace(PARAMS, 'params: [redacted]')
    .replace(URL_IN_TEXT, m => sanitizeUrl(m))
    .replace(PATH_IN_TEXT, (_m, lead: string, path: string) => `${lead}${parameterizePath(path)}`)
    .replace(PG_KEY, '([column])=([value])')
    .replace(QUOTED, '"[text]"')
    .replace(EMAIL, '[email]')
    .replace(BEARER, '$1 [token]')
    .replace(JWT, '[token]')
    .replace(UUID, '[id]')
    .replace(LONG_TOKEN, '[token]')
    .replace(DIGIT_RUN, '[number]')
    .slice(0, MAX_TEXT)
}

/** Client errors the caller caused (validation, auth, not found, rate limit): expected, never worth an alert. */
export function isExpectedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { status?: unknown; statusCode?: unknown; name?: unknown; issues?: unknown }
  for (const status of [e.status, e.statusCode]) if (typeof status === 'number' && status >= 400 && status < 500) return true
  return e.name === 'ZodError' || e.name === 'ValidationError' || (Array.isArray(e.issues) && e.name === 'ZodError')
}

/** Message patterns that are connectivity / browser noise rather than CRAFT bugs. */
export const IGNORE_ERRORS: Array<string | RegExp> = [
  /^ResizeObserver loop/,
  /^(Failed to fetch|NetworkError when attempting to fetch resource|Load failed|Network request failed)$/,
  /^(AbortError|The operation was aborted|The user aborted a request)/,
  'Non-Error promise rejection captured',
]

type Bag = Record<string, any>

export interface BreadcrumbContext {
  /** The visitor is on a page that can show assessment answers, evidence, scores or names. */
  sensitiveRoute: boolean
}

/** `beforeBreadcrumb`: returns the scrubbed breadcrumb, or null to drop it. */
export function scrubBreadcrumb<T extends Bag>(crumb: T, ctx: BreadcrumbContext): T | null {
  const category = String(crumb.category ?? '')
  const out: Bag = { type: crumb.type, category, level: crumb.level, timestamp: crumb.timestamp }
  if (category === 'console') {
    if (ctx.sensitiveRoute) return null
    out.message = typeof crumb.message === 'string' ? scrubText(crumb.message) : undefined
  } else if (category === 'ui.input') {
    return null
  } else if (category.startsWith('ui.')) {
    // Sentry builds this from the element's CSS selector. Drop attribute values and quoted text so no DOM text survives.
    const selector = typeof crumb.message === 'string' ? crumb.message.replace(/\[[^\]]*\]/g, '').replace(/(["'`])[^"'`]*\1/g, '') : ''
    out.message = scrubText(selector).trim().slice(0, 120)
  } else if (category === 'fetch' || category === 'xhr' || category === 'http') {
    const d: Bag = crumb.data ?? {}
    out.data = { method: d.method, status_code: d.status_code, ...(typeof d.url === 'string' ? { url: sanitizeUrl(d.url) } : {}) }
  } else if (category === 'navigation') {
    const d: Bag = crumb.data ?? {}
    out.data = { ...(typeof d.from === 'string' ? { from: sanitizeUrl(d.from) } : {}), ...(typeof d.to === 'string' ? { to: sanitizeUrl(d.to) } : {}) }
  } else {
    out.message = typeof crumb.message === 'string' ? scrubText(crumb.message) : undefined
  }
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k]
  return out as T
}

const KEEP_TAGS = new Set(['scope', 'runtime', 'handled', 'mechanism', 'route'])
const KEEP_CONTEXTS = new Set(['os', 'browser', 'runtime', 'trace'])

function scrubSpan(span: Bag): Bag {
  const out: Bag = { ...span }
  delete out.data
  delete out.tags
  if (typeof out.description === 'string') {
    // "GET https://host/api/orgs/12?x=1" -> "GET https://host/api/orgs/:id"
    out.description = out.description.replace(/^([A-Z]+)\s+(\S+)$/, (_m: string, method: string, target: string) => `${method} ${sanitizeUrl(target)}`)
    out.description = scrubText(out.description)
  }
  return out
}

/**
 * `beforeSend` / `beforeSendTransaction`: strips an event down to where it happened. Mutates and returns it
 * (Sentry hands over its own copy), or returns null to drop it.
 */
export function scrubEvent<T extends Bag>(event: T, ctx: BreadcrumbContext): T {
  const e: Bag = event
  delete e.user
  delete e.extra
  delete e.server_name
  delete e.modules
  delete e.request_body
  if (e.request) {
    const headers: Bag = e.request.headers ?? {}
    const ua = Object.entries(headers).find(([k]) => k.toLowerCase() === 'user-agent')
    e.request = {
      ...(typeof e.request.url === 'string' ? { url: sanitizeUrl(e.request.url) } : {}),
      ...(typeof e.request.method === 'string' ? { method: e.request.method } : {}),
      ...(ua ? { headers: { 'User-Agent': ua[1] } } : {}),
    }
  }
  if (typeof e.message === 'string') e.message = scrubText(e.message)
  if (e.logentry) e.logentry = { message: typeof e.logentry.message === 'string' ? scrubText(e.logentry.message) : undefined }
  for (const ex of e.exception?.values ?? []) {
    if (typeof ex.value === 'string') ex.value = scrubText(ex.value)
    for (const frame of ex.stacktrace?.frames ?? []) {
      delete frame.vars
      if (typeof frame.filename === 'string') frame.filename = stripQuery(frame.filename)
      if (typeof frame.abs_path === 'string') frame.abs_path = stripQuery(frame.abs_path)
    }
  }
  if (Array.isArray(e.breadcrumbs)) e.breadcrumbs = e.breadcrumbs.map((b: Bag) => scrubBreadcrumb(b, ctx)).filter(Boolean)
  if (e.tags) e.tags = Object.fromEntries(Object.entries(e.tags).filter(([k]) => KEEP_TAGS.has(k)).map(([k, v]) => [k, scrubText(String(v))]))
  if (e.contexts) {
    e.contexts = Object.fromEntries(Object.entries(e.contexts).filter(([k]) => KEEP_CONTEXTS.has(k)))
    if (e.contexts.trace) delete e.contexts.trace.data
  }
  if (typeof e.transaction === 'string') {
    e.transaction = e.transaction.startsWith('/') || /^https?:/.test(e.transaction) ? sanitizeUrl(e.transaction) : scrubText(e.transaction)
    if (e.transaction_info) e.transaction_info = { source: 'route' }
  }
  if (Array.isArray(e.spans)) e.spans = e.spans.map(scrubSpan)
  return event
}

/** True when the browser is on a page that may show assessment answers, evidence, scores or names. */
export const isSensitivePath = (pathname: string) => classifyPath(pathname) === 'sensitive'

/** Netlify CONTEXT -> the environment tag. */
export function environmentFromContext(context: string | null | undefined): string | undefined {
  if (!context) return undefined
  return ['production', 'deploy-preview', 'branch-deploy'].includes(context) ? context : 'development'
}

/**
 * Sentry v11 replaced `sendDefaultPii` with `dataCollection`, whose defaults collect most things (cookies, headers,
 * bodies, query strings, stack-frame variables). Switch every category off explicitly, in both SDKs.
 */
export const NO_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [] as never[],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  frameContextLines: 0,
}
