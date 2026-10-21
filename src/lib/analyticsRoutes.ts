// Which pages behaviour analytics may observe. This is an ALLOWLIST: every route
// file in src/routes is classified here, and anything that does not match a known
// route is treated as sensitive. analyticsRoutes.test.ts fails when a route file
// has no entry, so a new page cannot silently start being recorded.
//
//   marketing - public pages; session replay may show their text
//   allowed   - public or low-risk pages; replay masks all text and inputs
//   sensitive - assessments, evidence, workspaces, admin: no pageviews, no autocapture,
//               no replay, no heatmaps, no errors or web vitals
export type RouteClass = 'marketing' | 'allowed' | 'sensitive'

export const ROUTE_CLASS_BY_FILE: Record<string, RouteClass> = {
  // Public marketing
  index: 'marketing',
  'for.esg-reporting': 'marketing',
  'for.government': 'marketing',
  'for.public-health-institutes': 'marketing',
  methodology: 'marketing',
  architecture: 'marketing',
  institute: 'marketing',
  'open-source': 'marketing',
  launch: 'marketing',

  // Sign-up, onboarding, directory, training, public verification, policy and help pages
  auth: 'allowed',
  onboarding: 'allowed',
  directory: 'allowed',
  'directory_.$kind.$id': 'allowed',
  training: 'allowed',
  'training_.assessment': 'allowed',
  'training_.module.$moduleId': 'allowed',
  validation: 'allowed',
  'validation_.$verificationId': 'allowed',
  'acceptable-use': 'allowed',
  accessibility: 'allowed',
  'code-of-conduct': 'allowed',
  'data-processing': 'allowed',
  privacy: 'allowed',
  security: 'allowed',
  subprocessors: 'allowed',
  terms: 'allowed',
  help: 'allowed',
  guide: 'allowed',

  // Everything below can show assessment answers, evidence, scores, names or tokens.
  __root: 'sensitive',
  'accept.$token': 'sensitive',
  admin: 'sensitive',
  'admin_.portfolio': 'sensitive',
  'admin_.analytics': 'sensitive',
  // Signed links in emails: the token is in the address, so none of these may be recorded.
  'feedback.$token': 'sensitive',
  'email-preferences': 'sensitive',
  badge: 'sensitive',
  'assessment_.$frameworkId': 'sensitive',
  assessment: 'sensitive',
  'audit-log': 'sensitive',
  cip: 'sensitive',
  risk: 'sensitive',
  compliance: 'sensitive',
  contact: 'sensitive',
  dashboard: 'sensitive',
  'dashboard_.trust-delta': 'sensitive',
  'data-room': 'sensitive',
  demo: 'sensitive',
  engagements: 'sensitive',
  'engagements_.$id.review': 'sensitive',
  'engagements_.$id': 'sensitive',
  evidence: 'sensitive',
  'finance-triangulation': 'sensitive',
  findings: 'sensitive',
  frameworks: 'sensitive',
  'informal-economy': 'sensitive',
  'issb-disclosures': 'sensitive',
  'narrative-report': 'sensitive',
  obligations: 'sensitive',
  panel: 'sensitive',
  'panel_.$id': 'sensitive',
  'pre-assessment': 'sensitive',
  'regulatory-compliance': 'sensitive',
  reports: 'sensitive',
  settings: 'sensitive',
  'training_.manage': 'sensitive',
  validations: 'sensitive',
  'validations_.$id': 'sensitive',
  vaults: 'sensitive',
  verify: 'sensitive',
  wallboard: 'sensitive',
}

// The whole /app/* workspace platform is sensitive, including routes added later.
const SENSITIVE_PREFIXES = ['app']

export function classifyRouteFile(file: string): RouteClass | undefined {
  const name = file.replace(/\.tsx?$/, '')
  if (name in ROUTE_CLASS_BY_FILE) return ROUTE_CLASS_BY_FILE[name]
  if (SENSITIVE_PREFIXES.some(p => name.startsWith(`${p}.`))) return 'sensitive'
  return undefined
}

/** File-based route name -> URL pattern, e.g. `directory_.$kind.$id` -> `/directory/$kind/$id`. */
export function routeFilePattern(file: string): string {
  const parts = file.replace(/\.tsx?$/, '').split('.').map(s => s.replace(/_$/, ''))
  if (parts[parts.length - 1] === 'index') parts.pop()
  return `/${parts.join('/')}`
}

interface RoutePattern { pattern: string; regex: RegExp; cls: RouteClass; dynamic: number }
function compile(pattern: string, cls: RouteClass): RoutePattern {
  const segments = pattern.split('/').filter(Boolean)
  const body = segments.map(s => (s.startsWith('$') ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/')
  return { pattern, regex: new RegExp(`^/${body}$`), cls, dynamic: segments.filter(s => s.startsWith('$')).length }
}

const PATTERNS: RoutePattern[] = Object.entries(ROUTE_CLASS_BY_FILE)
  .filter(([file]) => file !== '__root')
  .map(([file, cls]) => compile(routeFilePattern(file), cls))
  // Static routes win over dynamic ones.
  .sort((a, b) => a.dynamic - b.dynamic)

const stripPath = (pathname: string) => {
  const path = pathname.split(/[?#]/)[0] || '/'
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

function match(pathname: string): RoutePattern | undefined {
  const path = stripPath(pathname)
  return PATTERNS.find(p => p.regex.test(path))
}

/** Unknown paths, and everything under /app, are sensitive. */
export function classifyPath(pathname: string): RouteClass {
  const path = stripPath(pathname)
  if (SENSITIVE_PREFIXES.some(p => path === `/${p}` || path.startsWith(`/${p}/`))) return 'sensitive'
  return match(path)?.cls ?? 'sensitive'
}

export const isTrackablePath = (pathname: string) => classifyPath(pathname) !== 'sensitive'

/** The route pattern for a path (`/directory/$kind/$id`), so ids never reach analytics. Null when not a trackable page. */
export function routePattern(pathname: string): string | null {
  const found = match(pathname)
  return found && found.cls !== 'sensitive' ? found.pattern : null
}
