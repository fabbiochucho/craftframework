// Feature switches (Admin → Features): which parts of CRAFT can be switched off, for whom, and how a setting is decided.
// Shared by the server guard (netlify/lib/feature-gate.ts) and the app (sidebar, route guard, Admin tab).
// Self-check: `node src/lib/features.test.ts`.
//
// Never switchable, so nobody is locked out and legal duties keep working: sign-in, dashboard, settings and team,
// privacy and data rights (export, deletion), the audit log, help, and Admin. The public verification page is also
// never switchable: funders must always be able to check a validation.

export type Feature = {
  key: string
  label: string
  description: string
  /** App routes the feature owns (prefix match). */
  routes: string[]
  /** API paths the feature owns (prefix match); the server refuses them while the feature is off. */
  api: string[]
}

export const FEATURES: Feature[] = [
  { key: 'frameworks', label: 'Assessment frameworks', description: 'Framework library and the assessment wizard.', routes: ['/frameworks', '/assessment'], api: [] },
  { key: 'capacity', label: 'Capacity Assessment', description: 'Capacity assessment modules, grant lifecycle (pre, during and post award), plans and reports.', routes: ['/capacity'], api: ['/api/cca', '/api/cca-screen'] },
  { key: 'awards', label: 'Awards & issues', description: 'Grants and contracts, funder measures, the issue register and track record sharing.', routes: ['/awards'], api: ['/api/awards'] },
  { key: 'findings', label: 'Findings', description: 'Findings from assessments.', routes: ['/findings'], api: [] },
  { key: 'verify', label: 'Trust delta & verify', description: 'Self-score against evidence-verified score.', routes: ['/verify', '/dashboard/trust-delta'], api: [] },
  { key: 'capacity-plan', label: 'Capacity plan', description: 'Capacity development plan and actions.', routes: ['/cip'], api: ['/api/capacity-actions'] },
  { key: 'risk', label: 'Quantified risk', description: 'Quantified (FAIR) risk.', routes: ['/risk'], api: [] },
  { key: 'finance-triangulation', label: 'Finance triangulation', description: 'Reconciling budgets, ledgers and bank records.', routes: ['/finance-triangulation'], api: ['/api/financial-triangulation'] },
  { key: 'data-room', label: 'Data room & evidence', description: 'Evidence uploads and the data room.', routes: ['/data-room', '/evidence', '/vaults'], api: ['/.netlify/functions/data-room-upload'] },
  { key: 'obligations', label: 'Obligations & compliance', description: 'Statutory obligations, filings and compliance calendar.', routes: ['/obligations', '/compliance'], api: ['/api/compliance'] },
  { key: 'regulatory', label: 'Global regulatory', description: 'Global regulatory compliance and laws register views.', routes: ['/regulatory-compliance'], api: [] },
  { key: 'issb', label: 'ISSB & CSRD disclosures', description: 'Sustainability disclosure tools.', routes: ['/issb-disclosures'], api: [] },
  { key: 'narrative-report', label: 'Narrative report generator', description: 'Generated narrative reports.', routes: ['/narrative-report'], api: [] },
  { key: 'informal-economy', label: 'Informal economy track', description: 'The informal economy track.', routes: ['/informal-economy'], api: [] },
  { key: 'reports', label: 'Reports', description: 'Reports and exports.', routes: ['/reports'], api: [] },
  { key: 'workspaces', label: 'Org workspaces', description: 'The organisation workspace platform (governance, ESG, QA, evidence).', routes: ['/app/workspaces'], api: [] },
  { key: 'directory', label: 'Validator directory', description: 'Validator, firm and funder profiles.', routes: ['/directory'], api: ['/api/directory', '/api/firms'] },
  { key: 'training', label: 'Validator training', description: 'Training modules, videos and assessments.', routes: ['/training'], api: ['/api/training'] },
  { key: 'engagements', label: 'Validation engagements', description: 'Engagements between organisations, validators and funders.', routes: ['/engagements'], api: ['/api/engagements'] },
  { key: 'validations', label: 'Validations', description: 'Independent validations and re-reviews.', routes: ['/validations'], api: ['/api/validations', '/api/validation-reviews', '/api/re-reviews', '/api/validator-quality'] },
  { key: 'networks', label: 'Networks', description: 'Networks, rounds, results, exchange and programme scorecards.', routes: ['/networks'], api: ['/api/networks', '/api/network-'] },
  { key: 'panel', label: 'Review panel', description: 'The independent review panel.', routes: ['/panel'], api: ['/api/review-panel'] },
  { key: 'support-bot', label: 'Support assistant', description: 'The in-app support chat.', routes: [], api: ['/api/support-bot/'] },
]

export const FEATURE_KEYS = FEATURES.map((f) => f.key)
export const SCOPES = ['global', 'archetype', 'country', 'network', 'org', 'user'] as const
export type Scope = (typeof SCOPES)[number]
export const SCOPE_LABEL: Record<Scope, string> = { global: 'Everyone', archetype: 'Organisation type', country: 'Country', network: 'Network', org: 'Organisation', user: 'User' }

export type Switch = { feature: string; scope: Scope; scopeId: string; enabled: boolean; reason: string; expiresAt: string | null }
export type Who = { email: string; orgId: string; archetype: string; country: string; networkIds: string[] }
export type Decision = { enabled: boolean; scope: Scope | 'default'; scopeId: string; reason: string }

const live = (s: Switch, now: Date) => !s.expiresAt || new Date(s.expiresAt).getTime() > now.getTime()
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * How a feature is decided for one person:
 * 1. Off for everyone is a kill switch: it wins over every other setting.
 * 2. Otherwise the most specific setting wins: user, then organisation, network, country, organisation type, everyone.
 * 3. If the organisation's networks disagree, off wins.
 * 4. With no setting, the feature is on. Expired settings are ignored.
 */
export function decide(feature: string, who: Who, switches: Switch[], now = new Date()): Decision {
  const mine = switches.filter((s) => s.feature === feature && live(s, now))
  const global = mine.find((s) => s.scope === 'global')
  if (global && !global.enabled) return { enabled: false, scope: 'global', scopeId: '', reason: global.reason }
  const pick = (scope: Scope, match: (id: string) => boolean): Decision | null => {
    const hits = mine.filter((s) => s.scope === scope && match(s.scopeId))
    if (!hits.length) return null
    const s = hits.find((h) => !h.enabled) ?? hits[0]
    return { enabled: s.enabled, scope, scopeId: s.scopeId, reason: s.reason }
  }
  return pick('user', (id) => !!who.email && same(id, who.email))
    ?? pick('org', (id) => !!who.orgId && id === who.orgId)
    ?? pick('network', (id) => who.networkIds.includes(id))
    ?? pick('country', (id) => !!who.country && same(id, who.country))
    ?? pick('archetype', (id) => !!who.archetype && same(id, who.archetype))
    ?? (global ? { enabled: true, scope: 'global', scopeId: '', reason: global.reason } : { enabled: true, scope: 'default', scopeId: '', reason: '' })
}

/** The feature that owns an app path or API path, if any. A prefix ending in "-" or "/" matches anything after it;
 *  any other prefix matches itself and the paths below it. */
export function featureForPath(path: string, kind: 'routes' | 'api'): Feature | undefined {
  const p = path.replace(/\/+$/, '') || '/'
  const owns = (r: string) => (/[-/]$/.test(r) ? p.startsWith(r) || p === r.slice(0, -1) : p === r || p.startsWith(`${r}/`))
  return FEATURES.find((f) => f[kind].some(owns))
}
