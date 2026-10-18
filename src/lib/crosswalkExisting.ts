// ============================================================================
// Crosswalk for CRAFT's existing questions, and one catalogue of every indicator.
// ----------------------------------------------------------------------------
// The core question bank is mapped by domain, the Capital Readiness Ladder by
// domain, the older CRAFT indices by dimension and ESG by pillar. The four
// v1 (102026) indices carry their own refs per indicator. Every mapping is
// CRAFT's judgement of relevance, reviewed by the founders; it is not an
// endorsement by, or certification against, any framework.
// Self-check: `node src/lib/crosswalkExisting.test.ts`.
// ============================================================================

import { MOCK_QUESTIONS } from './data.ts'
import { LADDER_INDICATORS } from './capitalReadiness.ts'
import { ESG_QUESTIONS } from './esg.ts'
import { applies, FOUNDATION_MODULES, type CrosswalkRef, type ModuleProfile } from './foundationModules.ts'

const refs = (s: string): CrosswalkRef[] => s.split(' ').map((t) => {
  const i = t.indexOf(':')
  return { framework: t.slice(0, i), ref: t.slice(i + 1) }
})
const table = (rows: Record<string, string>): Record<string, CrosswalkRef[]> =>
  Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, refs(v)]))

export const CORE_DOMAIN_REFS = table({
  'Governance & Leadership': 'ifc-cgdf:BOARD ifc-cgdf:COMMIT nccg-2018:BOARD coso-ic:CE mck-ohi:LEADERSHIP iso-37000:MS',
  'Legal & Regulatory': 'nccg-2018:CONDUCT iso-37301:MS coso-ic:RA',
  'Strategy & Planning': 'mck-ohi:DIRECTION mck-7s:STRATEGY star-model:STRATEGY bsc:FINANCIAL coso-erm:SO pefa:IV',
  'Human Resources': 'mck-7s:STAFF star-model:PEOPLE mck-ohi:CAPABILITIES iso-45001:MS iso-30414:MS afdb-iss:OS2',
  'Sustainability & Financing': 'bsc:FINANCIAL coso-erm:SO',
  'Financial Management': 'coso-ic:CA coso-ic:IC pefa:I pefa:VI ifc-cgdf:DISCLOSURE',
  'Procurement & Supply Chain': 'coso-ic:CA iso-37001:MS',
  'Risk & Internal Controls': 'coso-ic:RA coso-ic:CA coso-erm:PF iso-31000:6.4 iso-31000:6.5',
  'Audit & Assurance': 'coso-ic:MA coso-ic:P16 nccg-2018:ASSURANCE pefa:VII',
  'Ethics & Anti-Fraud': 'coso-ic:P1 coso-ic:P8 iso-37001:MS iso-37002:MS nccg-2018:CONDUCT',
  'Grant Management': 'coso-ic:CA coso-ic:MA gf-pr:TOOL',
  'Program & Project Mgmt': 'bsc:PROCESS mck-7s:SYSTEMS iso-9001:MS',
  'Monitoring, Evaluation & Learning': 'bsc:LEARNING mck-ohi:INNOVATION iso-9001:MS',
  'Partnerships & Stakeholders': 'mck-ohi:EXTERNAL ifc-cgdf:STAKEHOLDERS afdb-iss:OS10',
  'USG Compliance': 'coso-ic:CE coso-ic:CA coso-ic:MA iso-37301:MS',
  'International Donor Compliance': 'coso-ic:CE coso-ic:CA coso-ic:MA iso-37301:MS gf-pr:TOOL',
  'Digital Systems & Cyber': 'iso-27001:MS iso-27701:MS nist-csf-2:GV nist-csf-2:ID nist-csf-2:PR nist-csf-2:DE nist-csf-2:RS nist-csf-2:RC',
  'Emergency Preparedness': 'iso-22301:MS nist-csf-2:RC coso-erm:PF',
  'Research & Innovation': 'mck-ohi:INNOVATION bsc:LEARNING',
  'PMO & Delivery': 'bsc:PROCESS mck-ohi:COORDINATION iso-9001:MS',
  'Climate Governance': 'ifrs-s2:GOV ifrs-s2:STRAT ifrs-s2:RISK',
  'Env. & Social Safeguards': 'afdb-iss:OS1 afdb-iss:OS2 afdb-iss:OS4 afdb-iss:OS10 iso-14001:MS',
  'Climate Finance Access': 'ifrs-s2:STRAT ifrs-s1:STRAT',
  'MRV & Article 6': 'ifrs-s2:METRICS iso-14064-1:MS',
})

export const LADDER_DOMAIN_REFS = table({
  'Legal Structure & Registration': 'coso-ic:P3 iso-37301:MS',
  'Basic Financial Controls': 'coso-ic:CA coso-ic:P10',
  'Core Governance & Leadership': 'ifc-cgdf:BOARD nccg-2018:BOARD',
  'Auditable Financial Records': 'coso-ic:IC pefa:VI nccg-2018:ASSURANCE',
  'Transparent Governance & Reporting': 'ifc-cgdf:DISCLOSURE nccg-2018:TRANSPARENCY',
  'Evidence of Delivery': 'bsc:CUSTOMER bsc:PROCESS',
  'Financial Resilience & Reserves': 'bsc:FINANCIAL coso-erm:PF',
  'Operational & Crisis Continuity': 'iso-22301:MS',
  'Leadership Succession Planning': 'mck-7s:STAFF ifc-cgdf:BOARD',
  'Environmental & Resource Performance': 'iso-14001:MS iso-50001:MS afdb-iss:OS3',
  'Social Value & Human Capital': 'afdb-iss:OS2 iso-30414:MS',
  'Community Legitimacy': 'afdb-iss:OS4 afdb-iss:OS10',
  'Investment Case & Revenue Model': 'bsc:FINANCIAL gfa:TOOL',
  'Cash-Flow Visibility & Bankability': 'bsc:FINANCIAL gfa:TOOL',
  'Investor Protections & Regulatory Certainty': 'ifc-cgdf:SHAREHOLDERS nccg-2018:SHAREHOLDERS',
  'Institutional Depth & Systems': 'mck-7s:SYSTEMS star-model:PROCESSES',
  'Data & Controls Maturity': 'coso-ic:IC iso-27001:MS',
  'Replicability & Partnerships': 'mck-ohi:EXTERNAL',
  'Development Finance / DFI Readiness': 'ifc-cgdf:COMMIT afdb-iss:OS1',
  'Capital Markets & Credit Readiness': 'ifc-cgdf:DISCLOSURE nccg-2018:TRANSPARENCY',
  'Sustainability-Linked / Green Finance Readiness': 'ifrs-s1:METRICS ifrs-s2:METRICS',
})

/** Older CRAFT indices, keyed `moduleId:dimension`. The v1 (102026) indices carry refs per indicator. */
export const MODULE_DIMENSION_REFS = table({
  'craft-resilience:financial': 'bsc:FINANCIAL coso-erm:PF',
  'craft-resilience:funding': 'coso-erm:SO',
  'craft-resilience:operational': 'iso-22301:MS',
  'craft-resilience:people': 'mck-7s:STAFF',
  'craft-resilience:digital': 'iso-27001:MS nist-csf-2:RC',
  'craft-resilience:risk': 'coso-erm:PF iso-31000:6.4',
  'craft-transformation:foresight': 'coso-erm:SO burke-litwin:EXTERNAL',
  'craft-transformation:learning': 'mck-ohi:INNOVATION bsc:LEARNING',
  'craft-transformation:innovation': 'mck-ohi:INNOVATION',
  'craft-transformation:change': 'kotter:VISION adkar:AWARENESS burke-litwin:CULTURE',
  'craft-transformation:digital': 'nist-csf-2:GV iso-42001:MS',
  'craft-transformation:model': 'star-model:STRATEGY',
  'craft-legacy:memory': 'mck-ohi:CAPABILITIES',
  'craft-legacy:pipeline': 'mck-7s:STAFF ifc-cgdf:BOARD',
  'craft-legacy:governance': 'ifc-cgdf:BOARD nccg-2018:BOARD',
  'craft-legacy:finance': 'bsc:FINANCIAL',
  'craft-legacy:mission': 'mck-7s:SHARED_VALUES',
  'craft-legacy:stewardship': 'ifrs-s1:STRAT iso-26000:MS',
})

export const ESG_PILLAR_REFS = table({
  Environmental: 'ifrs-s2:METRICS iso-14001:MS afdb-iss:OS3',
  Social: 'afdb-iss:OS2 afdb-iss:OS4 iso-26000:MS',
  Governance: 'ifc-cgdf:BOARD ifrs-s1:GOV nccg-2018:BOARD',
})

export type CatalogueSource = 'core' | 'ladder' | 'esg' | 'module'

export interface CatalogueEntry {
  id: string
  source: CatalogueSource
  sourceName: string
  question: string
  refs: CrosswalkRef[]
  applies: (p?: ModuleProfile) => boolean
  /** Core questions in a thematic lens are asked only when that lens is switched on. */
  lens?: string
}

const always = () => true

/** Every indicator CRAFT asks, with the framework elements it relates to. */
export const INDICATOR_CATALOGUE: CatalogueEntry[] = [
  ...MOCK_QUESTIONS.map((q): CatalogueEntry => ({ id: q.id, source: 'core', sourceName: 'Core assessment', question: q.question, refs: CORE_DOMAIN_REFS[q.domain] ?? [], applies: always, ...(q.lens ? { lens: q.lens } : {}) })),
  ...LADDER_INDICATORS.map((q): CatalogueEntry => ({ id: q.id, source: 'ladder', sourceName: 'Capital Readiness Ladder', question: q.question, refs: LADDER_DOMAIN_REFS[q.domain] ?? [], applies: always })),
  ...ESG_QUESTIONS.map((q): CatalogueEntry => ({ id: q.id, source: 'esg', sourceName: 'ESG Self-Assessment', question: q.question, refs: ESG_PILLAR_REFS[q.pillar] ?? [], applies: always })),
  ...FOUNDATION_MODULES.flatMap((m) => m.indicators.map((i): CatalogueEntry => ({
    id: i.id, source: 'module', sourceName: m.title, question: i.question,
    refs: i.crosswalk ?? MODULE_DIMENSION_REFS[`${m.id}:${i.dimension}`] ?? [],
    applies: (p) => applies(i, p),
  }))),
]

/** Catalogue entries mapped to a framework (and, when given, one of its elements). */
export function indicatorsFor(framework: string, element?: string): CatalogueEntry[] {
  return INDICATOR_CATALOGUE.filter((e) => e.refs.some((r) => r.framework === framework && (element === undefined || r.ref === element)))
}
