import { QUESTION_INDEX, type IndexedQuestion } from './questionIndex.ts'

export interface Question {
  id: string
  domain: string
  tier: number
  tierName: string
  question: string
  insight: string
  evidence: string[]
  verificationMethod: string
  score: number
  maxScore: number
  riskIfWeak: 'Critical' | 'High' | 'Moderate' | 'Low'
  capacityAction: string
  donorLink: string
  nationalLink: string
  priority: 'Critical' | 'High' | 'Moderate' | 'Low'
  riskCategory?: string
  evidenceNote?: string
  // Thematic lens this question belongs to. Undefined = part of the always-on
  // Core Foundation (the fiduciary G2G, DFI and donor baseline).
  lens?: LensId
  // Scoring rubric (0–5 maturity anchors), surfaced in the wizard where present.
  scoringGuide?: string
  // Entity archetypes this question applies to. Undefined = universal (shown to
  // every archetype). When present, the question is rendered ONLY for a matching
  // workspace archetype - e.g. a Cap Table question is Private-only, a Supreme
  // Audit Institution question is Public-only.
  archetypes?: Archetype[]
  // Optional link to a Data Room requirement that satisfies this question's
  // evidence - the wizard surfaces a "Link from Data Room" affordance for these.
  requiredDataRoomDoc?: string
}

// The three institutional archetypes the platform adapts to. The Core fiduciary
// bank is universal; archetype tags carve out the entity-specific questions and
// drive the dynamic Pan-African Data Room (see lib/dataroom.ts).
export type Archetype = 'Public' | 'Civil Society' | 'Private'

export const ARCHETYPES: { id: Archetype; label: string; blurb: string }[] = [
  { id: 'Public', label: 'Public Sector', blurb: 'Ministries, agencies, regulators & sub-national entities' },
  { id: 'Civil Society', label: 'Civil Society', blurb: 'NGOs, foundations, cooperatives & member bodies' },
  { id: 'Private', label: 'Private Sector', blurb: 'SMEs, startups & corporates seeking capital or contracts' },
]

// A question is visible for a given archetype when it is universal (no archetype
// tag) or explicitly tagged for that archetype. With no archetype selected, only
// the universal Core bank is shown.
export function archetypeMatch(q: Question, archetype?: Archetype | ''): boolean {
  if (!q.archetypes) return true
  return !!archetype && q.archetypes.includes(archetype)
}

export interface Organization {
  id: string
  name: string
  country: string
  targetDonor: string
  email: string
  createdAt: string
  lastUpdated: string
  scores: Record<string, number>
  // Email of the Portfolio Reviewer accountable for this institution. Super
  // Admins are never recorded here - platform oversight is not a "reviewer".
  reviewer?: string
  // Soft-archive flag: 'active' (default) | 'archived'. Archived institutions
  // are hidden from working surfaces but retained and restorable.
  status?: 'active' | 'archived'
}

// A portfolio is a named grouping of institutions administered by a Portfolio
// Reviewer (or created by a Super Admin for platform oversight). Reviewers may
// own several portfolios; each scopes the comparison and reporting surfaces.
export interface Portfolio {
  id: string
  name: string
  orgIds: string[]
  // Email of the Portfolio Reviewer who administers this portfolio. Left unset
  // for Super-Admin-created portfolios so admins are never listed as reviewers.
  reviewer?: string
  firmId?: string
  // Soft-archive flag: 'active' (default) | 'archived'.
  status?: 'active' | 'archived'
}

export interface User {
  id: string
  email: string
  orgId: string
  role: 'assessor' | 'admin'
}

export interface CIPItem {
  id: string
  qId: string
  domain: string
  gapDescription: string
  rootCause: string
  capacityAction: string
  owner: string
  dueDate: string
  status: 'Not Started' | 'In Progress' | 'Completed'
  evidenceLink?: string
}

// ============================================================================
// CRAFT (ICARF v4.0) - 450-Question Master Bank
// 5 tiers · 20 domains. The bank below is the canonical source of truth; the
// rich UI fields (insight, evidence, action, links) come either from a curated
// enrichment overlay for the most critical questions or sensible per-domain
// defaults for the rest.
// ============================================================================

export const TIER_NAMES = [
  'Organizational Maturity',
  'Fiduciary Assurance',
  'Grant Management',
  'Donor & USG Readiness',
  'Digital & Operational Readiness',
]

// Friendly display labels for the 20 CSV domain codes.
const DOMAIN_DISPLAY: Record<string, string> = {
  Governance: 'Governance & Leadership',
  Legal: 'Legal & Regulatory',
  Strategy: 'Strategy & Planning',
  HR: 'Human Resources',
  Sustainability: 'Sustainability & Financing',
  Finance: 'Financial Management',
  Procurement: 'Procurement & Supply Chain',
  Risk: 'Risk & Internal Controls',
  Audit: 'Audit & Assurance',
  Ethics: 'Ethics & Anti-Fraud',
  Grant: 'Grant Management',
  Program: 'Program & Project Mgmt',
  MEL: 'Monitoring, Evaluation & Learning',
  Partnership: 'Partnerships & Stakeholders',
  USG: 'USG Compliance',
  International: 'International Donor Compliance',
  Digital: 'Digital Systems & Cyber',
  Emergency: 'Emergency Preparedness',
  Research: 'Research & Innovation',
  PMO: 'PMO & Delivery',
}

export const DOMAINS = Object.values(DOMAIN_DISPLAY)

// ============================================================================
// Modular Sovereignty - Thematic Lenses
// ----------------------------------------------------------------------------
// CRAFT respects institutional sovereignty: the fiduciary Core Foundation is
// always active, while institutions activate only the thematic lenses relevant
// to their mandate, donor requirements, and national context. The Dashboard and
// Assessment Wizard recalculate dynamically against the active lenses.
// ============================================================================

export type LensId = 'climate' | 'emergency' | 'research'

export interface Lens {
  id: LensId
  name: string
  emoji: string
  description: string
  geoNote: string
  defaultOn: boolean
  // Domains this lens governs in the question bank.
  domains: string[]
}

// Domains owned by the Climate & ESG lens (the 50 new CLIM questions below).
const CLIMATE_DOMAINS = [
  'Climate Governance',
  'Env. & Social Safeguards',
  'Climate Finance Access',
  'MRV & Article 6',
]

export const LENSES: Lens[] = [
  {
    id: 'climate',
    name: 'Climate, ESG & Article 6 Lens',
    emoji: '🌍',
    description:
      'Assesses Environmental & Social Safeguards, Climate Budget Tagging, MRV systems, and Paris Agreement Article 6 carbon market readiness.',
    geoNote:
      'Recommended for institutions seeking GCF/WB Direct Access or engaging in sovereign carbon markets.',
    defaultOn: true,
    domains: CLIMATE_DOMAINS,
  },
  {
    id: 'emergency',
    name: 'Emergency & Health Security Lens',
    emoji: '🚨',
    description:
      'Assesses Emergency Operations Center (EOC) readiness, surge capacity, and emergency supply chain logistics.',
    geoNote:
      'Recommended for National Public Health Institutes and institutions with an emergency-response mandate.',
    defaultOn: true,
    domains: ['Emergency Preparedness'],
  },
  {
    id: 'research',
    name: 'Research, Data & Innovation Lens',
    emoji: '🔬',
    description:
      'Assesses research ethics (IRB), genomic/data sovereignty, and intellectual property management.',
    geoNote:
      'Recommended for institutions running research programmes or managing sensitive scientific data.',
    defaultOn: true,
    domains: ['Research & Innovation'],
  },
]

export const LENS_BY_ID: Record<LensId, Lens> = Object.fromEntries(
  LENSES.map(l => [l.id, l]),
) as Record<LensId, Lens>

// A lens is active by default when its defaultOn flag is set. The Core Foundation
// (everything not owned by a lens) is always active.
export function defaultActiveLenses(): Record<LensId, boolean> {
  return LENSES.reduce(
    (acc, l) => ({ ...acc, [l.id]: l.defaultOn }),
    {} as Record<LensId, boolean>,
  )
}

// The question text is private: the public code holds each question's structure (questionIndex.ts) plus a demo
// sample with text. Signed-in users load the full bank from /api/questions, and setQuestionBank() swaps it in, so
// every reader of MOCK_QUESTIONS (a live binding) sees the full text once it has loaded.
const fromIndex = (q: IndexedQuestion): Question => ({
  question: '', insight: '', evidence: [], verificationMethod: '', capacityAction: '', donorLink: '', nationalLink: '', ...q,
})
// An empty archetype list from the database means "every archetype", the same as no list.
const normalise = (q: Question): Question => (q.archetypes?.length ? q : { ...q, archetypes: undefined })

export let MOCK_QUESTIONS: Question[] = QUESTION_INDEX.map(fromIndex)
export let CLIMATE_QUESTIONS: Question[] = MOCK_QUESTIONS.filter(q => q.lens === 'climate')

export function setQuestionBank(full: Question[]): void {
  MOCK_QUESTIONS = full.map(normalise)
  CLIMATE_QUESTIONS = MOCK_QUESTIONS.filter(q => q.lens === 'climate')
}

/** True once a question's text is available (always for the demo sample; for all questions once signed in). */
export const hasText = (q: Question): boolean => !!q.question

// Resolve which lens a question belongs to (or undefined for the Core Foundation).
export function questionLens(q: Question): LensId | undefined {
  if (q.lens) return q.lens
  for (const lens of LENSES) {
    if (lens.id !== 'climate' && lens.domains.includes(q.domain)) return lens.id
  }
  return undefined
}

// The number of questions each lens contributes to the assessment.
export function lensQuestionCount(id: LensId): number {
  return MOCK_QUESTIONS.filter(q => questionLens(q) === id).length
}

// The set of questions visible for a given lens activation map. A question is
// visible when it is part of the Core Foundation OR its lens is active.
export function activeQuestions(active: Record<LensId, boolean>): Question[] {
  return MOCK_QUESTIONS.filter(q => {
    const lens = questionLens(q)
    return hasText(q) && (!lens || active[lens])
  })
}

// Human-readable scope label, e.g. "Core + Climate & ESG + Emergency".
export function scopeLabel(active: Record<LensId, boolean>): string {
  const on = LENSES.filter(l => active[l.id]).map(l => l.name.replace(/ Lens$/, ''))
  return ['Core Foundation', ...on].join(' + ')
}

// --- DOMAIN MAPPING ---
export const DOMAIN_WEIGHTS: Record<string, number> = {
  'Governance & Leadership': 0.08,
  'Legal & Regulatory': 0.05,
  'Strategy & Planning': 0.04,
  'Human Resources': 0.04,
  'Sustainability & Financing': 0.04,
  'Financial Management': 0.12,
  'Procurement & Supply Chain': 0.10,
  'Risk & Internal Controls': 0.07,
  'Audit & Assurance': 0.06,
  'Ethics & Anti-Fraud': 0.05,
  'Grant Management': 0.07,
  'Program & Project Mgmt': 0.04,
  'Monitoring, Evaluation & Learning': 0.03,
  'Partnerships & Stakeholders': 0.02,
  'USG Compliance': 0.05,
  'International Donor Compliance': 0.04,
  'Digital Systems & Cyber': 0.05,
  'Emergency Preparedness': 0.02,
  'Research & Innovation': 0.01,
  'PMO & Delivery': 0.02,
}

export const COMPOSITE_INDICES = [
  'Governance',
  'Fiduciary',
  'Grant Mgmt',
  'Program Delivery',
  'Digital',
  'Risk Mgmt',
  'Sustainability',
  'USG Compliance',
  'Resilience',
]

// --- MOCK ORGANIZATIONS ---
// `scores` below holds the curated narrative seeds for the most critical
// questions; full coverage of the 450-question bank is generated
// deterministically further down so dashboards remain meaningful.
export const MOCK_ORGANIZATIONS: Organization[] = [
  {
    id: 'org-001',
    name: 'National Public Health Agency',
    country: 'Kenya',
    targetDonor: 'USAID',
    email: 'admin@npha.go.ke',
    createdAt: '2024-11-15',
    lastUpdated: '2025-06-01',
    scores: {
      'GOV-01': 3, 'GOV-05': 2, 'LEG-01': 3, 'HR-02': 2,
      'FIN-13': 1, 'FIN-28': 1, 'FIN-22': 2, 'FIN-42': 2,
      'PROC-11': 2, 'RISK-06': 2, 'AUD-04': 2, 'ETH-04': 1,
      'GRANT-06': 3, 'GRANT-09': 1, 'GRANT-12': 2,
      'USG-01': 2, 'USG-13': 1, 'USG-22': 1, 'USG-31': 2,
      'DIG-05': 1, 'DIG-13': 2, 'PMO-02': 2, 'EPR-02': 3,
    }
  },
  {
    id: 'org-002',
    name: 'Ministry of Health, Disease Control Directorate',
    country: 'Uganda',
    targetDonor: 'Global Fund',
    email: 'admin@moh-dcd.go.ug',
    createdAt: '2024-10-22',
    lastUpdated: '2025-05-18',
    scores: {
      'GOV-01': 4, 'GOV-05': 3, 'LEG-01': 4, 'HR-02': 3,
      'FIN-13': 2, 'FIN-28': 2, 'FIN-22': 3, 'FIN-42': 3,
      'PROC-11': 3, 'RISK-06': 3, 'AUD-04': 3, 'ETH-04': 2,
      'GRANT-06': 4, 'GRANT-09': 2, 'GRANT-12': 3,
      'USG-01': 3, 'USG-13': 2, 'USG-22': 2, 'USG-31': 3,
      'DIG-05': 2, 'DIG-13': 3, 'PMO-02': 3, 'EPR-02': 4,
    }
  },
  {
    id: 'org-003',
    name: 'National AIDS Control Agency',
    country: 'Tanzania',
    targetDonor: 'PEPFAR/CDC',
    email: 'admin@naca.go.tz',
    createdAt: '2024-09-05',
    lastUpdated: '2025-04-30',
    scores: {
      'GOV-01': 2, 'GOV-05': 1, 'LEG-01': 2, 'HR-02': 1,
      'FIN-13': 1, 'FIN-28': 1, 'FIN-22': 1, 'FIN-42': 1,
      'PROC-11': 1, 'RISK-06': 1, 'AUD-04': 1, 'ETH-04': 1,
      'GRANT-06': 2, 'GRANT-09': 1, 'GRANT-12': 1,
      'USG-01': 1, 'USG-13': 1, 'USG-22': 1, 'USG-31': 1,
      'DIG-05': 1, 'DIG-13': 1, 'PMO-02': 1, 'EPR-02': 2,
    }
  },
  {
    id: 'org-004',
    name: 'Federal Ministry of Finance, Grants Unit',
    country: 'Nigeria',
    targetDonor: 'World Bank',
    email: 'admin@fmfgrants.gov.ng',
    createdAt: '2024-08-14',
    lastUpdated: '2025-06-03',
    scores: {
      'GOV-01': 4, 'GOV-05': 4, 'LEG-01': 5, 'HR-02': 4,
      'FIN-13': 3, 'FIN-28': 3, 'FIN-22': 4, 'FIN-42': 4,
      'PROC-11': 4, 'RISK-06': 4, 'AUD-04': 4, 'ETH-04': 3,
      'GRANT-06': 4, 'GRANT-09': 3, 'GRANT-12': 4,
      'USG-01': 3, 'USG-13': 3, 'USG-22': 3, 'USG-31': 4,
      'DIG-05': 3, 'DIG-13': 4, 'PMO-02': 4, 'EPR-02': 4,
    }
  },
]

// Per-org maturity baseline used to generate full-bank coverage deterministically.
const ORG_BASELINE: Record<string, number> = {
  'org-001': 2.3,
  'org-002': 3.0,
  'org-003': 1.5,
  'org-004': 3.7,
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Deterministic 0–5 score for an (org, question) pair - stable across renders/SSR.
function seededScore(orgId: string, qId: string, baseline: number): number {
  const jitter = (hashStr(`${orgId}|${qId}`) % 1000) / 1000 // 0..1
  const offset = jitter * 2.6 - 1.3 // -1.3..+1.3
  return Math.max(0, Math.min(5, Math.round(baseline + offset)))
}

// Expand each org's narrative seeds to full coverage of the 450-question bank.
for (const org of MOCK_ORGANIZATIONS) {
  const baseline = ORG_BASELINE[org.id] ?? 2.5
  const full: Record<string, number> = {}
  for (const q of MOCK_QUESTIONS) full[q.id] = seededScore(org.id, q.id, baseline)
  org.scores = { ...full, ...org.scores }
}

// CRAFT-authored Readiness Architecture modules (Resilience, Transformation &
// Adaptability, Legacy - see foundationModules.ts) store their indicator scores
// in the same per-org map under this prefix. They are reported on their own
// scales, so the core-bank aggregates below skip them.
export const MODULE_SCORE_PREFIX = 'CRAFT-'
export const isCoreScoreKey = (k: string) => !k.startsWith(MODULE_SCORE_PREFIX)

// Helper: compute overall score percentage for an org
export function computeOrgScore(scores: Record<string, number>): number {
  const keys = Object.keys(scores).filter(isCoreScoreKey)
  if (keys.length === 0) return 0
  const total = keys.reduce((sum, k) => sum + (scores[k] || 0), 0)
  return Math.round((total / (keys.length * 5)) * 100)
}

// Helper: get readiness classification
export function getReadinessClassification(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: 'Accredited G2G, DFI and Donor Partner', color: 'text-emerald-700', bg: 'bg-emerald-100' }
  if (score >= 80) return { label: 'Direct Funding Ready', color: 'text-emerald-600', bg: 'bg-emerald-50' }
  if (score >= 70) return { label: 'Ready with Conditions', color: 'text-emerald-700', bg: 'bg-emerald-100' }
  if (score >= 60) return { label: 'Moderate Risk', color: 'text-amber-700', bg: 'bg-amber-100' }
  if (score >= 50) return { label: 'Significant Capacity Gaps', color: 'text-amber-600', bg: 'bg-amber-50' }
  return { label: 'Not Ready for Direct Funding', color: 'text-rose-700', bg: 'bg-rose-100' }
}

export function getRiskColor(score: number) {
  if (score <= 1) return { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Critical', border: 'border-rose-300' }
  if (score === 2) return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'High', border: 'border-amber-300' }
  if (score === 3) return { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Moderate', border: 'border-yellow-200' }
  return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Low', border: 'border-emerald-300' }
}

export function computeTierScore(
  scores: Record<string, number>,
  tier: number,
  active?: Record<LensId, boolean>,
): number {
  // Tier completeness is measured only over questions currently in scope, so a
  // deactivated lens never dilutes the percentage. When no lens map is supplied,
  // the Core Foundation plus the default-on lenses are counted.
  const inScope = (q: Question) => {
    const lens = questionLens(q)
    if (!lens) return true
    return active ? active[lens] : LENS_BY_ID[lens].defaultOn
  }
  const tierQs = MOCK_QUESTIONS.filter(q => q.tier === tier && inScope(q))
  if (tierQs.length === 0) return 0
  const total = tierQs.reduce((sum, q) => sum + (scores[q.id] || 0), 0)
  return Math.round((total / (tierQs.length * 5)) * 100)
}

export function computeDomainScore(scores: Record<string, number>, domain: string): number {
  const domainQs = MOCK_QUESTIONS.filter(q => q.domain === domain)
  if (domainQs.length === 0) return 0
  const total = domainQs.reduce((sum, q) => sum + (scores[q.id] || 0), 0)
  return Math.round((total / (domainQs.length * 5)) * 100)
}

// Composite score for the Climate & ESG lens (average across its four domains).
export function computeClimateScore(scores: Record<string, number>): number {
  return Math.round(
    CLIMATE_DOMAINS.reduce((sum, d) => sum + computeDomainScore(scores, d), 0) / CLIMATE_DOMAINS.length,
  )
}

export function computeCompositeIndices(
  scores: Record<string, number>,
  active?: Record<LensId, boolean>,
) {
  const avg = (...vals: number[]) => Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  const indices = [
    { name: 'Governance', value: avg(computeDomainScore(scores, 'Governance & Leadership'), computeDomainScore(scores, 'Legal & Regulatory')) },
    { name: 'Fiduciary', value: computeDomainScore(scores, 'Financial Management') },
    { name: 'Grant Mgmt', value: computeDomainScore(scores, 'Grant Management') },
    { name: 'Program Delivery', value: avg(computeDomainScore(scores, 'Program & Project Mgmt'), computeDomainScore(scores, 'PMO & Delivery'), computeDomainScore(scores, 'Monitoring, Evaluation & Learning')) },
    { name: 'Digital', value: computeDomainScore(scores, 'Digital Systems & Cyber') },
    { name: 'Risk Mgmt', value: avg(computeDomainScore(scores, 'Risk & Internal Controls'), computeDomainScore(scores, 'Audit & Assurance')) },
    { name: 'Sustainability', value: avg(computeDomainScore(scores, 'Sustainability & Financing'), computeDomainScore(scores, 'Human Resources')) },
    { name: 'USG Compliance', value: avg(computeDomainScore(scores, 'USG Compliance'), computeDomainScore(scores, 'International Donor Compliance')) },
  ]

  // Resilience axis is driven by the Emergency & Research lenses. When lens
  // activation is supplied, the axis reflects only the active modules and is
  // dropped entirely if neither is active.
  const emergencyOn = !active || active.emergency
  const researchOn = !active || active.research
  const resilienceParts: number[] = []
  if (emergencyOn) resilienceParts.push(computeDomainScore(scores, 'Emergency Preparedness'))
  if (researchOn) resilienceParts.push(computeDomainScore(scores, 'Research & Innovation'))
  if (resilienceParts.length) indices.push({ name: 'Resilience', value: avg(...resilienceParts) })

  // Climate & ESG axis appears only when the lens is active.
  if (active?.climate) indices.push({ name: 'Climate & ESG', value: computeClimateScore(scores) })

  return indices
}

// ============================================================================
// CRAFT (ICARF v4.0) - DiBadili Institute extensions
// ============================================================================

export const BRAND = {
  product: 'CRAFT',
  framework: 'ICARF v4.0',
  expansion: 'Capacity Readiness & Fiduciary Assurance Toolkit',
  fullName: 'CRAFT: Capacity Readiness & Fiduciary Assurance Toolkit',
  institute: 'DiBadili Institute',
  instituteUrl: 'https://www.becomechange.institute',
  instituteMeaning: 'Become Change',
  tagline: 'The CRAFT Framework: Building Fiduciary Trust for Direct G2G, DFI and Donor Partnerships.',
  heroSubtitle:
    'The CRAFT Framework: Building Fiduciary Trust for Direct G2G, DFI and Donor Partnerships.',
  contactEmail: 'craftframework@becomechange.institute',
  socials: {
    linkedin: 'https://www.linkedin.com/company/dibadili-institute/',
    facebook: 'https://www.facebook.com/DiBadiliAfrica',
    instagram: 'https://www.instagram.com/dibadiliafrica',
    x: 'https://x.com/dibadiliafrica',
  },
  mandate: 'From Policy Intent to Execution Clarity.',
  footer:
    '© 2026 DiBadili Institute. CRAFT (ICARF v4.0) is an open-source public good. Software GPL-3.0 | Framework CC BY-SA 4.0.',
} as const

// --- Super Admin access mapping --------------------------------------------
// Emails that are granted the Super Admin (Global Control Center) view level the
// moment they sign in - regardless of the provider used (password, Google, or
// GitHub). Matching is case-insensitive. A GitHub or Google login resolves to
// the account's primary email, so listing the email here covers all three
// sign-in methods for the same person.
export const SUPER_ADMIN_EMAILS: readonly string[] = ['fabbiochucho@gmail.com']

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === normalized)
}

// --- Strict status badge legend -------------------------------------------
export type RiskStatus =
  | 'Completed-Validated'
  | 'Completed-Invalidated'
  | 'On-Track'
  | 'In-Progress'
  | 'Off-Track'
  | 'To-be-Initiated'

export const RISK_STATUSES: RiskStatus[] = [
  'Completed-Validated',
  'Completed-Invalidated',
  'On-Track',
  'In-Progress',
  'Off-Track',
  'To-be-Initiated',
]

export const STATUS_STYLES: Record<
  RiskStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  'Completed-Validated': { label: 'Completed-Validated', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  'Completed-Invalidated': { label: 'Completed-Invalidated', bg: 'bg-slate-200', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-500' },
  'On-Track': { label: 'On-Track', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-500' },
  'In-Progress': { label: 'In-Progress', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-500' },
  'Off-Track': { label: 'Off-Track', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300', dot: 'bg-rose-500' },
  'To-be-Initiated': { label: 'To-be-Initiated', bg: 'bg-white', text: 'text-slate-500', border: 'border-slate-300', dot: 'bg-slate-300' },
}

// --- Universal mock data injection -----------------------------------------
// Universalized findings abstracted from global fiduciary assessments.
// NO specific country or agency names are used.
export interface UniversalRisk {
  id: string
  topic: string
  domain: string
  tier: number
  severity: 'Critical' | 'High' | 'Moderate' | 'Low'
  description: string
  mitigation: string
  status: RiskStatus
  owner: string
  dueDate: string
}

export const UNIVERSAL_RISKS: UniversalRisk[] = [
  {
    id: 'FIN-01', topic: 'Grant Experience', domain: 'Grant Management', tier: 3, severity: 'High',
    description: 'The Agency lacks direct experience managing large-scale multilateral grants as a principal recipient. Current scope pales in comparison to target funding size.',
    mitigation: 'Donor capacity building & Principal Recipient mentorship.',
    status: 'In-Progress', owner: 'Director, Programmes', dueDate: 'Q2, Month 6',
  },
  {
    id: 'FIN-08', topic: 'Cash Bottlenecks', domain: 'Financial Management', tier: 2, severity: 'High',
    description: 'No alternative mechanisms or contingency plans in place for situations where national banking penetration is low or treasury disbursements are delayed.',
    mitigation: 'Develop formal cash flow contingency plan.',
    status: 'To-be-Initiated', owner: 'Head of Finance', dueDate: 'Q3, Month 9',
  },
  {
    id: 'FIN-13', topic: 'Accounting Software', domain: 'Financial Management', tier: 2, severity: 'Critical',
    description: 'Legacy accounting software cannot generate trial balances for individual donors. Reconciliations require manual spreadsheet intervention.',
    mitigation: 'Upgrade system and train finance team on advanced modules.',
    status: 'In-Progress', owner: 'Head of Finance / ICT', dueDate: 'Q2, Month 5',
  },
  {
    id: 'FIN-28', topic: 'Internal Controls', domain: 'Internal Controls', tier: 2, severity: 'Critical',
    description: 'Poor advance management. Significant project funds paid directly to individual staff personal bank accounts, resulting in late retirement.',
    mitigation: 'Directive issued to pay beneficiaries/vendors directly.',
    status: 'In-Progress', owner: 'Head of Finance', dueDate: 'Q1, Month 2',
  },
  {
    id: 'GOV-01', topic: 'Oversight', domain: 'Governance & Leadership', tier: 1, severity: 'Critical',
    description: 'No evidence that the Supreme Audit Institution (SAI) or National Legislature systematically reviews financial reports and provides formal oversight feedback.',
    mitigation: 'Ensure minutes and audit reports are formally filed and tracked.',
    status: 'In-Progress', owner: 'Board Secretary', dueDate: 'Q2, Month 6',
  },
  {
    id: 'PROC-11', topic: 'Procurement Docs', domain: 'Procurement & Supply Chain', tier: 2, severity: 'High',
    description: 'Unable to ascertain the basis of vendor selection for IT/office equipment; solicitation documents and evaluation matrices missing from procurement files.',
    mitigation: 'Document procedures based on SOP and archive supporting docs.',
    status: 'In-Progress', owner: 'Head of Procurement', dueDate: 'Q2, Month 4',
  },
  {
    id: 'FIN-42', topic: 'Asset Tagging', domain: 'Financial Management', tier: 2, severity: 'Moderate',
    description: 'Fixed assets are tagged with degradable printed-paper tags. No evidence of annual physical asset verification exercises.',
    mitigation: 'Change tagging mode; conduct annual physical verification.',
    status: 'In-Progress', owner: 'Head of Administration', dueDate: 'Q3, Month 8',
  },
  {
    id: 'ETH-04', topic: 'Whistleblowing', domain: 'Ethics & Anti-Fraud', tier: 2, severity: 'High',
    description: 'Internal fraud reporting requires staff to include names in petitions to the Executive Director. Lack of anonymity creates retaliation risks.',
    mitigation: 'Anonymous whistleblowing policy being enshrined in manual.',
    status: 'On-Track', owner: 'Head of Internal Audit', dueDate: 'Q2, Month 5',
  },
  {
    id: 'FIN-32', topic: 'Interim Reporting', domain: 'Financial Management', tier: 2, severity: 'Moderate',
    description: 'Agency not mandated to prepare interim financial reports outside the annual government cycle. Annual frequency prevents swift error correction.',
    mitigation: 'Quarterly financial reports now prepared for donor compliance.',
    status: 'In-Progress', owner: 'Head of Finance', dueDate: 'Q1, Month 3',
  },
  {
    id: 'AUD-04', topic: 'Audit Scope', domain: 'Audit & Compliance', tier: 2, severity: 'High',
    description: 'Internal Audit scope inadequate. Unit only reviews Finance and Admin functions quarterly, excluding all other operational/programmatic units.',
    mitigation: 'SOP developed to guide review of all units.',
    status: 'On-Track', owner: 'Head of Internal Audit', dueDate: 'Q2, Month 6',
  },
  {
    id: 'PROC-19', topic: 'Supply Planning', domain: 'Procurement & Supply Chain', tier: 5, severity: 'Moderate',
    description: 'Quantification is done, but no integrated national supply plan exists. Donated and procured pipelines are not synchronized.',
    mitigation: 'Integrated supply plan developed with technical assistance.',
    status: 'On-Track', owner: 'Supply Chain Lead', dueDate: 'Q3, Month 9',
  },
  {
    id: 'PROC-17', topic: 'Warehousing', domain: 'Procurement & Supply Chain', tier: 5, severity: 'High',
    description: 'Current warehousing arrangements suboptimal for emergency response. Inventory management weak, distribution services largely ad hoc.',
    mitigation: 'Finalizing Warehousing Transition Plan; hiring specialists.',
    status: 'In-Progress', owner: 'Supply Chain Lead', dueDate: 'Q4, Month 12',
  },
  {
    id: 'PROC-29', topic: 'Lab Quality', domain: 'Procurement & Supply Chain', tier: 5, severity: 'High',
    description: 'National Reference Laboratory lacks ISO/IEC 17025 certification. Donated medical/health products not routinely sampled by National Regulatory Authority.',
    mitigation: 'Liaising with an already ISO-certified partner lab.',
    status: 'In-Progress', owner: 'Quality Assurance Lead', dueDate: 'Q4, Month 14',
  },
  {
    id: 'DIG-05', topic: 'LMIS Digital', domain: 'Digital Systems', tier: 5, severity: 'Critical',
    description: 'Logistics Management Information System (LMIS) used only at central headquarters. Sub-national facility reporting rates critically low.',
    mitigation: 'Legacy system decommissioned; procurement of new cloud LMIS ongoing.',
    status: 'Off-Track', owner: 'Head of ICT', dueDate: 'Q5, Month 18',
  },
]

export function severityStyle(sev: UniversalRisk['severity']) {
  switch (sev) {
    case 'Critical': return { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' }
    case 'High': return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' }
    case 'Moderate': return { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' }
    default: return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' }
  }
}

// --- Accreditation engine + Paper Compliance Penalty -----------------------
// Implementation evidence (0-100) measures system-enforced execution, not paper.
// If implementation evidence < 50%, accreditation is mathematically capped.
export const PAPER_COMPLIANCE_THRESHOLD = 50

export interface Accreditation {
  level: 'A' | 'B' | 'C' | 'D' | 'E'
  label: string
  color: string
  bg: string
  ring: string
  rawLevel: 'A' | 'B' | 'C' | 'D' | 'E'
  capped: boolean
  composite: number
}

const LEVEL_META: Record<Accreditation['level'], { label: string; color: string; bg: string; ring: string }> = {
  A: { label: 'Level A: Fully Accredited', color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-400' },
  B: { label: 'Level B: Accredited with Conditions', color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-300' },
  C: { label: 'Level C: Provisional', color: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-400' },
  D: { label: 'Level D: Strengthening Required', color: 'text-orange-700', bg: 'bg-orange-50', ring: 'ring-orange-400' },
  E: { label: 'Level E: Not Yet Eligible', color: 'text-rose-700', bg: 'bg-rose-50', ring: 'ring-rose-400' },
}

function levelFromScore(score: number): Accreditation['level'] {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'E'
}

const LEVEL_ORDER: Accreditation['level'][] = ['A', 'B', 'C', 'D', 'E']

export function getAccreditation(composite: number, implementationEvidence: number): Accreditation {
  const rawLevel = levelFromScore(composite)
  // Paper Compliance Penalty Engine: cap accreditation at Level C when
  // implementation evidence falls below threshold, regardless of paper score.
  let level = rawLevel
  let capped = false
  if (implementationEvidence < PAPER_COMPLIANCE_THRESHOLD) {
    const cappedFloorIndex = LEVEL_ORDER.indexOf('C')
    if (LEVEL_ORDER.indexOf(rawLevel) < cappedFloorIndex) {
      level = 'C'
      capped = true
    }
  }
  return { level, rawLevel, capped, composite, ...LEVEL_META[level] }
}

// Per-org implementation evidence (system-enforced execution %), mock.
export const ORG_IMPLEMENTATION_EVIDENCE: Record<string, number> = {
  'org-001': 42, // triggers Paper Compliance Penalty banner
  'org-002': 61,
  'org-003': 31,
  'org-004': 78,
}

export function getImplementationEvidence(orgId: string): number {
  return ORG_IMPLEMENTATION_EVIDENCE[orgId] ?? 50
}

// --- Donor frameworks (onboarding alignment) -------------------------------
export const DONOR_FRAMEWORKS = [
  { id: 'usaid', name: 'USAID / 2 CFR 200', desc: 'US Government Uniform Guidance & ADS series.' },
  { id: 'globalfund', name: 'Global Fund', desc: 'FMS, PR capacity & sub-recipient management.' },
  { id: 'worldbank', name: 'World Bank', desc: 'Financial Management & Procurement frameworks.' },
  { id: 'gavi', name: 'Gavi', desc: 'Programme funding & transparency policy.' },
  { id: 'eu', name: 'EU / DEVCO', desc: 'Pillar Assessment (PAGoDA) compliance.' },
]

export const MANDATE_TYPES = ['Ministry', 'National Public Health Institute (NPHI)', 'NGO', 'Regulatory Authority', 'Sub-National Entity']

// --- Portfolios (Portfolio Admin scoping) ----------------------------------
// Illustrative portfolios used ONLY to seed the demo workspace. A live
// workspace starts with no portfolios - Portfolio Reviewers and Super Admins
// create their own. The demo reviewer mirrors the seeded demo team member.
export const MOCK_PORTFOLIOS: Portfolio[] = [
  { id: 'pf-east', name: 'East Africa Portfolio', orgIds: ['org-001', 'org-002', 'org-003'], reviewer: 'd.mwangi@craft.demo' },
  { id: 'pf-west', name: 'West Africa Portfolio', orgIds: ['org-004'], reviewer: 'd.mwangi@craft.demo' },
]

// --- Access / view levels (the user-preference tiers) ----------------------
// Every member of the platform is granted one of these view levels. The level
// determines what they can see and is enforced through the sidebar navigation
// and the role gates on the Super Admin and Portfolio Admin portals.
//
// Two administrative tiers exist and must not be confused:
//   • `admin` (Administrator) — a normal, assignable role for someone running
//     their OWN organization or a consultancy: they onboard institutions, manage
//     their team and access grants, and review their client book. Their reach is
//     scoped to what they administer, never the whole platform.
//   • `super_admin` (Super Admin) — the sole platform operator. Platform-wide
//     control of every feature, institution, the question bank and the global
//     audit log. Reserved for the single allowlisted operator (see
//     [[SUPER_ADMIN_EMAILS]]); invisible to, and unassignable by, everyone else.
export type ViewLevel = 'assessor' | 'independent' | 'portfolio' | 'admin' | 'super_admin'

export interface ViewLevelMeta {
  id: ViewLevel
  label: string
  short: string
  scopeKind: 'organization' | 'portfolio' | 'platform'
  scopeNoun: string
  description: string
  badge: { bg: string; text: string }
}

export const VIEW_LEVELS: ViewLevelMeta[] = [
  {
    id: 'assessor',
    label: 'Organization Assessor',
    short: 'Assessor',
    scopeKind: 'organization',
    scopeNoun: 'a single institution',
    description:
      'Works inside one institution’s secure workspace: dashboard, assessment wizard, findings, evidence vault and capacity plan.',
    badge: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  },
  {
    id: 'independent',
    label: 'Independent Assessor',
    short: 'Independent',
    scopeKind: 'organization',
    scopeNoun: 'a single institution (independent review)',
    description:
      'An external reviewer (e.g. a consultant or LFA) scoped to one institution. Their scores are recorded independently of the institution’s self-assessment and reconciled on the Trust Delta screen.',
    badge: { bg: 'bg-violet-100', text: 'text-violet-700' },
  },
  {
    id: 'portfolio',
    label: 'Portfolio Reviewer',
    short: 'Portfolio',
    scopeKind: 'portfolio',
    scopeNoun: 'a collection of institutions',
    description:
      'Compares readiness across an assigned portfolio of institutions. Adds the Portfolio Admin portal; records outside the portfolio stay isolated.',
    badge: { bg: 'bg-blue-100', text: 'text-blue-700' },
  },
  {
    id: 'admin',
    label: 'Administrator',
    short: 'Admin',
    scopeKind: 'organization',
    scopeNoun: 'their organization or consultancy',
    description:
      'Administers their own institution or a consultancy: onboard institutions, manage the team and access, and review the client book. Adds the Portfolio Admin portal. Reach is scoped to what they administer, not the whole platform.',
    badge: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  },
  {
    id: 'super_admin',
    label: 'Super Admin',
    short: 'Super Admin',
    scopeKind: 'platform',
    scopeNoun: 'the entire platform',
    description:
      'Sole platform operator: full control of every institution, portfolios, the question bank, global domain weights and the security audit log. Reserved for the single allowlisted operator and never assignable to anyone else.',
    badge: { bg: 'bg-amber-100', text: 'text-amber-800' },
  },
]

export function getViewLevel(id: ViewLevel): ViewLevelMeta {
  return VIEW_LEVELS.find(v => v.id === id) ?? VIEW_LEVELS[0]
}

// Roles an admin may hand out from the portal, or a user may self-select as
// their working view. The `super_admin` tier is deliberately excluded: it is
// reserved for the single allowlisted operator (see [[SUPER_ADMIN_EMAILS]]) and
// is never assignable to anyone else, so the platform always has exactly one
// Super Admin. The ordinary `admin` (Administrator) tier IS assignable.
export const ASSIGNABLE_VIEW_LEVELS: ViewLevelMeta[] = VIEW_LEVELS.filter(v => v.id !== 'super_admin')

// The effective view level for an email given the role assigned to it in the
// directory. The super-admin allowlist is the SOLE source of platform
// `super_admin` rights: a listed operator is always `super_admin`; for anyone
// else a `super_admin` assignment is clamped down to `admin` (the highest
// assignable tier), so only the allowlisted operator can ever hold platform
// Super Admin access.
export function effectiveViewLevel(email: string | null | undefined, assigned?: string | null): ViewLevel {
  if (isSuperAdminEmail(email)) return 'super_admin'
  const role = (assigned as ViewLevel) || 'assessor'
  return role === 'super_admin' ? 'admin' : role
}

// --- Session timeout (security-bounded user preference) --------------------
// Assessors may choose an idle-logout window, but only within a safe range so
// nobody can leave a session open indefinitely. Bounds: 5–60 minutes.
export const SESSION_TIMEOUT_MIN = 5
export const SESSION_TIMEOUT_MAX = 60
export const SESSION_TIMEOUT_DEFAULT = 15
export const SESSION_TIMEOUT_OPTIONS = [5, 10, 15, 30, 45, 60] as const

// Clamp any requested timeout into the permitted security range.
export function clampSessionTimeout(minutes: number): number {
  if (Number.isNaN(minutes)) return SESSION_TIMEOUT_DEFAULT
  return Math.min(SESSION_TIMEOUT_MAX, Math.max(SESSION_TIMEOUT_MIN, Math.round(minutes)))
}

export interface EvidenceDoc {
  id: string
  name: string
  type: 'PDF' | 'XLSX' | 'DOCX' | 'IMG'
  domain: string
  linkedRisk: string
  sizeKb: number
  uploadedBy: string
  uploadedAt: string
  status: 'Validated' | 'Pending Review' | 'Invalidated'
}

export const EVIDENCE_DOCS: EvidenceDoc[] = [
  { id: 'EV-001', name: 'Board_Minutes_Q1.pdf', type: 'PDF', domain: 'Governance & Leadership', linkedRisk: 'GOV-01', sizeKb: 842, uploadedBy: 'Board Secretary', uploadedAt: '2026-02-12', status: 'Validated' },
  { id: 'EV-002', name: 'Donor_Trial_Balance_Test.xlsx', type: 'XLSX', domain: 'Financial Management', linkedRisk: 'FIN-13', sizeKb: 311, uploadedBy: 'Head of Finance', uploadedAt: '2026-02-20', status: 'Pending Review' },
  { id: 'EV-003', name: 'Advance_Payment_Directive.pdf', type: 'PDF', domain: 'Internal Controls', linkedRisk: 'FIN-28', sizeKb: 156, uploadedBy: 'Head of Finance', uploadedAt: '2026-01-30', status: 'Validated' },
  { id: 'EV-004', name: 'Procurement_File_Index_SOP.docx', type: 'DOCX', domain: 'Procurement & Supply Chain', linkedRisk: 'PROC-11', sizeKb: 98, uploadedBy: 'Head of Procurement', uploadedAt: '2026-03-04', status: 'Pending Review' },
  { id: 'EV-005', name: 'Whistleblower_Policy_Draft.pdf', type: 'PDF', domain: 'Ethics & Anti-Fraud', linkedRisk: 'ETH-04', sizeKb: 204, uploadedBy: 'Head of Internal Audit', uploadedAt: '2026-03-11', status: 'Validated' },
  { id: 'EV-006', name: 'Asset_Register_2026.xlsx', type: 'XLSX', domain: 'Financial Management', linkedRisk: 'FIN-42', sizeKb: 529, uploadedBy: 'Head of Administration', uploadedAt: '2026-02-28', status: 'Invalidated' },
  { id: 'EV-007', name: 'Integrated_Supply_Plan.pdf', type: 'PDF', domain: 'Procurement & Supply Chain', linkedRisk: 'PROC-19', sizeKb: 1204, uploadedBy: 'Supply Chain Lead', uploadedAt: '2026-03-18', status: 'Validated' },
  { id: 'EV-008', name: 'LMIS_Architecture_v2.pdf', type: 'PDF', domain: 'Digital Systems', linkedRisk: 'DIG-05', sizeKb: 766, uploadedBy: 'Head of ICT', uploadedAt: '2026-03-22', status: 'Pending Review' },
]

// --- Audit log -------------------------------------------------------------
export interface AuditEntry {
  id: string
  timestamp: string
  actor: string
  action: string
  target: string
  category: 'Auth' | 'Assessment' | 'Evidence' | 'Config' | 'Export'
}

export const AUDIT_LOG: AuditEntry[] = [
  { id: 'A-1042', timestamp: '2026-06-06 09:14:22', actor: 'admin@workspace', action: 'Signed in', target: 'Secure Vault', category: 'Auth' },
  { id: 'A-1041', timestamp: '2026-06-06 09:15:03', actor: 'admin@workspace', action: 'Updated score', target: 'FIN-13 → 2', category: 'Assessment' },
  { id: 'A-1040', timestamp: '2026-06-05 16:48:51', actor: 'finance@workspace', action: 'Uploaded evidence', target: 'Donor_Trial_Balance_Test.xlsx', category: 'Evidence' },
  { id: 'A-1039', timestamp: '2026-06-05 14:02:10', actor: 'audit@workspace', action: 'Validated evidence', target: 'Whistleblower_Policy_Draft.pdf', category: 'Evidence' },
  { id: 'A-1038', timestamp: '2026-06-05 11:31:44', actor: 'admin@workspace', action: 'Exported report', target: 'Executive Summary (PDF)', category: 'Export' },
  { id: 'A-1037', timestamp: '2026-06-04 17:55:09', actor: 'admin@workspace', action: 'Bulk import', target: 'CRAFT_Template.csv (450 rows)', category: 'Assessment' },
  { id: 'A-1036', timestamp: '2026-06-04 10:12:37', actor: 'sysadmin@dibadili', action: 'Adjusted global weight', target: 'Financial Management 0.12', category: 'Config' },
  { id: 'A-1035', timestamp: '2026-06-03 08:47:19', actor: 'finance@workspace', action: 'Signed in', target: 'Secure Vault', category: 'Auth' },
]

// --- Help: FAQs + Glossary -------------------------------------------------
export const FAQS = [
  // Signing in & account access
  { q: 'How do I sign in to CRAFT?', a: 'Open the sign-in screen and enter the work email and password you registered with. New here? Switch to the Register tab, name your institution, pick the category you are registering as, and create a password of at least 6 characters - you will then confirm your email before your first sign-in. Where your organization has enabled social sign-in, a "continue with" option (Google and/or GitHub) also appears beneath the form.' },
  { q: 'Which sign-in methods are available?', a: 'Email and password is always available. Google and GitHub single sign-on are also supported, but each only appears on the sign-in screen when it has been switched on for the site under Identity → External providers. CRAFT checks the live provider configuration on load and only shows a social button when that provider is actually enabled, so you will never be offered a button that cannot complete.' },
  { q: 'The GitHub (or Google) sign-in button is missing or was not working - why?', a: 'A social button only appears when that provider is enabled in the site’s Identity settings. If GitHub is not showing, it has not been enabled for your deployment yet - an administrator can turn it on under Identity → External providers, after which the button appears automatically. If GitHub is enabled but sign-in fails, the usual cause is that GitHub did not share a verified email address: make sure your GitHub account has a verified, non-private primary email, then try again. In the meantime you can always sign in with your email and password.' },
  { q: 'I signed in with Google or GitHub - which organization and role do I get?', a: 'Social sign-in resolves to your account’s primary email, and CRAFT looks that email up in the user directory. If an administrator has already assigned you to an institution or portfolio, you land in that workspace at the role they set. If not, you start in your own isolated workspace at the category you registered as. Signing in with a password, Google, or GitHub for the same email always resolves to the same account.' },
  { q: 'Where can I find a full user guide?', a: 'Open User Guide from the sidebar (under Support, next to Help & Glossary). It is an interactive, step-by-step walkthrough of the whole platform - from signing in and onboarding to the assessment wizard, findings, capacity plan, data room and reports. You can filter it to your access level, search it, track which sections you have read, and download the entire guide as a self-contained file or print it to PDF to read offline or share with colleagues.' },

  // Who CRAFT is for - organizational archetypes
  { q: 'Who is CRAFT built for?', a: 'CRAFT serves any institution that needs to prove fiduciary trust to a government (G2G), a Development Finance Institution (DFI), or a donor. It adapts to three organizational archetypes - Public Sector (ministries, agencies, regulators, National Public Health Institutes and sub-national entities), Civil Society (NGOs, foundations, cooperatives, faith-based and member bodies), and Private Sector (SMEs, startups and corporates seeking capital or contracts). A universal fiduciary core applies to all three, and archetype-specific questions are layered on top.' },
  { q: 'Which archetype should I choose for my organization?', a: 'Pick the archetype that matches your legal form and mandate. Public Sector covers government and statutory bodies that answer to a Supreme Audit Institution. Civil Society covers not-for-profits, NGOs, foundations and cooperatives that rely on grants and member trust. Private Sector covers for-profit companies - from startups to corporates - pursuing investment, lending or commercial contracts. Your choice is set during onboarding and tailors the entire assessment; you can refine it later from your workspace profile.' },
  { q: 'How does the assessment change for each archetype?', a: 'Every institution answers the universal Core fiduciary questions on governance, finance, procurement, risk and ethics. On top of that, CRAFT injects archetype-specific questions: Private Sector entities pick up cap-table, beneficial-ownership, unit-economics and ESG questions; Civil Society entities pick up board-independence, restricted-fund, safeguarding and MEL questions; Public Sector entities pick up SAI oversight and public-accountability questions. Questions that do not apply to your archetype are never shown.' },
  { q: "I'm a startup or private company - is CRAFT relevant to me?", a: 'Yes. The Private Sector archetype is designed for SMEs, startups and corporates raising capital or bidding for donor- and government-backed contracts. It assesses the same fiduciary discipline investors and DFIs expect - clean cap tables, verified beneficial ownership, credible unit economics, and ESG/safeguard controls - and turns gaps into an investor-ready strengthening plan.' },
  { q: 'We are an NGO or foundation - how is CRAFT different for us?', a: 'The Civil Society archetype focuses on the trust signals grant-makers and multilateral donors look for: an independent board, segregation between governance and management, restricted-fund accounting, anonymous whistleblowing, safeguarding, and credible monitoring, evaluation and learning (MEL). Your readiness score and capacity plan are framed around grant eligibility and Principal Recipient capacity.' },
  { q: 'We are a ministry or public agency - what does CRAFT assess for us?', a: 'The Public Sector archetype emphasizes public accountability: oversight by the Supreme Audit Institution, transparency of public finances, sub-national reporting reach, and the controls donors require before channelling funds Government-to-Government (G2G). It is well-suited to ministries, regulatory authorities, National Public Health Institutes and sub-national entities.' },
  { q: 'How do sector and subsector affect my assessment?', a: 'After choosing an archetype you select a sector (e.g. Fintech, NGO-Health, or Ministry of Finance) and, where relevant, a subsector (e.g. Digital Lending, Humanitarian, or Disease Surveillance). These sharpen your dynamic Data Room checklist so the platform asks for exactly the regulatory evidence your kind of institution must hold - a crypto fintech, for example, picks up VASP obligations a payments fintech does not.' },
  { q: 'What are thematic lenses and should I switch them on?', a: 'Lenses are optional question packs you can toggle to match your context: the Climate, ESG & Article 6 lens (environmental and social safeguards, climate budget tagging, carbon-market readiness), the Emergency & Health Security lens (emergency operations and surge logistics), and the Research, Data & Innovation lens (research ethics, data sovereignty and IP). Activate the lenses that reflect your mandate; they add targeted questions without changing your Core baseline.' },
  { q: 'Which donor frameworks can I align my accreditation to?', a: 'During onboarding you map your assessment to the funders that matter to you - USAID / 2 CFR 200, the Global Fund, the World Bank, Gavi and the EU / DEVCO (PAGoDA). CRAFT cross-references your answers against each selected framework so your findings speak directly to those donors’ fiduciary standards.' },

  // Access levels - the three user types
  { q: 'What are the access levels in CRAFT?', a: 'Every user is granted one view level. An Organization Assessor works inside a single institution’s secure workspace - dashboard, wizard, findings, evidence vault and capacity plan. A Portfolio Reviewer compares readiness across an assigned portfolio of institutions and gains the Portfolio Admin portal, while records outside their portfolio stay isolated. An Administrator has admin access across the platform: every institution, portfolios, the question bank, global domain weights and the security audit log.' },
  { q: 'Can a Portfolio Reviewer see inside every institution?', a: 'No. A reviewer only sees the institutions explicitly assigned to their portfolio. Multi-tenant isolation is enforced by organization_id, so an institution’s detailed scores and evidence are never visible to reviewers outside its portfolio, and never to other assessors.' },
  { q: 'How do I add colleagues, and what roles can they have?', a: 'From Team & Roles (or during onboarding) you invite colleagues by email and assign each a view level scoped to the right institution or portfolio. Co-assessors join scoped to your institution; reviewers are scoped to a named portfolio. Invitations are logged in the audit trail.' },

  // Getting started & filling the assessment
  { q: 'How do I begin a CRAFT assessment?', a: 'Register your institution, confirm your email, then complete onboarding - naming your workspace, choosing your archetype, sector and country, and selecting your donor frameworks. The Assessment Wizard then opens with the questions tailored to your profile. Work through the five tiers in order; each question carries an insight and a 0–5 maturity slider, and your answers save to your private vault and immediately drive your dashboard, findings, and capacity plan.' },
  { q: 'What does the 0–5 maturity score mean for each question?', a: '0 = no evidence the control exists; 1 = ad-hoc or informal; 2 = documented but not consistently applied; 3 = applied but not independently verified; 4 = implemented and monitored; 5 = fully system-enforced with audit trails. Scores of 0–2 are treated as gaps and flow into your Findings and Capacity Plan automatically.' },
  { q: 'How do my answers become Findings and a Capacity Plan?', a: 'Every question you answer at 2 or below becomes a finding, classified Critical (0–1) or High (2). Each finding is then converted into a costed, owned, time-bound action in your 24-Month Capacity Plan. The owner is assigned from the question’s domain and the due date is scheduled by severity, with critical gaps front-loaded into the first six months.' },
  { q: 'Do I have to answer every question before I see results?', a: 'No. The dashboard, findings register, and capacity plan are built only from the questions you have actually answered, so they fill in progressively as you work. You can save and return at any time; unanswered questions are simply excluded until you score them.' },
  { q: 'What is the 7-Point Evidence Matrix?', a: 'Beneath each question you record where the control sits on the implementation ladder: from No Evidence through Drafted, Approved, Disseminated, Partially Implemented, Implemented, to System-Enforced. This captures execution maturity, not just whether a policy exists on paper.' },
  { q: 'How is my Implementation Evidence percentage calculated?', a: 'It is the share of your answered questions that score 4 or higher, i.e. controls that are genuinely implemented or system-enforced. It updates live as you complete the wizard and directly determines whether the Paper Compliance Penalty applies.' },
  { q: 'What is the Paper Compliance Penalty Engine?', a: 'When your live Implementation Evidence falls below 50%, your accreditation level is mathematically capped at Level C, regardless of how strong your policy manuals look on paper. CRAFT rewards execution, not documentation.' },
  { q: 'What do the 5 Tiers represent?', a: 'Organizational Maturity, Fiduciary Assurance, Grant Management, Donor & USG Readiness, and Digital & Operational Readiness, the full lifecycle from governance to field execution.' },
  { q: 'How is my accreditation level (A–E) determined?', a: 'Your weighted composite score across all 20 domains maps to a raw level (A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, E below 40). The Paper Compliance Penalty can then cap that level if implementation evidence is weak, so two institutions with identical paper scores can land on different levels.' },
  { q: 'Can I import existing scores instead of entering them by hand?', a: 'Yes. Use Bulk Import in the Assessment Wizard to upload a single CRAFT template file under 5MB. It is scanned, sanitized, and validated, and each row is written into your vault exactly as if you had entered it manually.' },
  { q: 'How do I track progress on closing a gap?', a: 'Open the Capacity Plan and set each action’s status: To-be-Initiated, In-Progress, On-Track, Off-Track, Completed-Validated, or Completed-Invalidated. The dashboard summarises how many actions are off-track so leadership can intervene early.' },
  { q: 'Can I export my results for the Board or a donor?', a: 'Yes. The Reports Export Center generates a board-ready Executive Summary (PDF) and a full 24-Month Capacity Plan (Excel/CSV). Both are built from your own answers, with owners, due dates, mitigation actions, and statuses included.' },
  { q: 'What is the Data Room and how does it relate to my answers?', a: 'The Data Room is your dynamic evidence vault. Based on your archetype, sector, subsector and country, CRAFT generates the exact list of regulatory and fiduciary documents your institution should hold, then tracks each as Missing, Uploaded, Verified or Flagged. Wizard questions can link directly to the Data Room item that satisfies their evidence, so your readiness score and your document trail stay in sync.' },
  { q: 'How is my data isolated from other organizations?', a: 'Every record is scoped by organization_id. You can only read and write scores belonging to your own workspace, and the audit log records activity from your first sign-in onward so you have a complete, tamper-evident history. Portfolio Reviewers see only their assigned institutions, and administrators are never recorded as reviewers of any single institution.' },
  { q: 'What is the difference between the live workspace and the demo?', a: 'Your workspace starts empty and reflects only the data you enter. The demo opens in a separate tab pre-loaded with illustrative sample institutions - including an example assessor workspace and a portfolio view - so you can explore every screen and access level. Nothing in the demo touches or appears in your real vault.' },
]

export const GLOSSARY = [
  // CRAFT platform terms
  { term: 'CRAFT', def: 'Capacity Readiness & Fiduciary Assurance Toolkit - the platform that diagnoses, accredits, strengthens and monitors institutional readiness for G2G, DFI and donor partnerships.' },
  { term: 'ICARF v4.0', def: 'The Institutional Capacity Assessment & Readiness Framework underlying CRAFT: 5 tiers and 20 domains scored on a 0–5 maturity scale.' },
  { term: 'Archetype', def: 'The organizational type a workspace belongs to - Public Sector, Civil Society or Private Sector - which determines the archetype-specific questions layered on the universal fiduciary core.' },
  { term: 'Thematic Lens', def: 'An optional question pack (Climate/ESG & Article 6, Emergency & Health Security, or Research, Data & Innovation) that adds context-specific questions without changing the Core baseline.' },
  { term: 'Data Room', def: 'The dynamic evidence vault that lists the regulatory and fiduciary documents an institution should hold - generated from its archetype, sector, subsector and country - and tracks each as Missing, Uploaded, Verified or Flagged.' },
  { term: 'Implementation Evidence', def: 'The share of answered questions scoring 4 or higher (genuinely implemented or system-enforced); it determines whether the Paper Compliance Penalty applies.' },
  { term: 'Paper Compliance Penalty', def: 'A rule that caps accreditation at Level C when Implementation Evidence falls below 50%, so documentation alone cannot inflate a score.' },
  { term: 'Organization Assessor', def: 'A view level scoped to a single institution’s workspace: dashboard, wizard, findings, evidence vault and capacity plan.' },
  { term: 'Portfolio Reviewer', def: 'A view level that compares readiness across an assigned portfolio of institutions, with records outside the portfolio kept isolated.' },
  { term: 'Administrator', def: 'A view level with admin access across the platform: every institution, portfolios, the question bank, global domain weights and the security audit log.' },
  // Donor & fiduciary terms
  { term: '2 CFR 200', def: 'US Government Uniform Guidance governing federal award management, cost principles, and audit requirements.' },
  { term: 'Principal Recipient (PR)', def: 'The entity legally accountable to a multilateral donor for the implementation of a grant.' },
  { term: 'Trial Balance', def: 'A report listing all ledger balances; donors require it disaggregated per grant.' },
  { term: 'LMIS', def: 'Logistics Management Information System: tracks commodity stock from central to sub-national facilities.' },
  { term: 'SAI', def: 'Supreme Audit Institution: the national body providing external oversight of public finances.' },
  { term: 'Single Audit', def: 'An organization-wide audit required for entities expending federal funds above a threshold (2 CFR 200 Subpart F).' },
  { term: 'ISO/IEC 17025', def: 'International standard for the competence of testing and calibration laboratories.' },
  { term: 'Segregation of Duties', def: 'Control principle ensuring no single individual can initiate, approve, and record a transaction.' },
  { term: 'PAGoDA', def: 'The EU’s Pillar Assessment for Grants or Delegation Agreements, used to verify an entity’s systems before channelling EU funds.' },
  { term: 'Beneficial Ownership', def: 'The natural persons who ultimately own or control an entity; disclosure is a baseline fiduciary and anti-money-laundering control.' },
]

// 4-Layer lifecycle (methodology)
export const LIFECYCLE = [
  { step: 1, name: 'Assessment', desc: 'Diagnose institutional readiness across 5 tiers and 20 domains using a 0–5 maturity scale backed by a 7-point evidence matrix.' },
  { step: 2, name: 'Accreditation', desc: 'Compute a Level A–E rating. The Paper Compliance Penalty Engine caps the level when implementation evidence is weak.' },
  { step: 3, name: 'Strengthening', desc: 'Convert every gap into a costed, owned, and time-bound action within a Capacity Improvement Plan scheduled to your own chosen timeframe.' },
  { step: 4, name: 'Monitoring', desc: 'Track validated execution over time, re-scoring as evidence matures and donor frameworks evolve.' },
]

export const STRATEGIC_PILLARS = [
  { name: 'Advisory & Strategy', desc: 'Translating policy intent into executable institutional strategy.' },
  { name: 'Policy Innovation & Research', desc: 'Evidence-led frameworks for African public institutions.' },
  { name: 'Systems Leadership', desc: 'Building leaders who become the change their systems require.' },
]

export const PANAFRICAN_BADGES = [
  'Excellence in Institutional Quality',
  'Pan-African Perspective',
  'Integrity & Principled Leadership',
  'Afro-Continuous Development Mindset',
]

export const BLINDSPOTS = [
  { title: 'The Spreadsheet Trap', desc: 'Legacy accounting systems unable to generate automated donor-specific trial balances.', icon: 'spreadsheet' },
  { title: 'The Sub-National Blindspot', desc: 'Centralized logistics systems with critically low facility-level reporting.', icon: 'map' },
  { title: 'The Paper Compliance Illusion', desc: 'Institutions with perfect policy manuals but zero system-enforced implementation.', icon: 'paper' },
  { title: 'The Anonymity Gap', desc: 'Whistleblowing mechanisms requiring staff names, deterring fraud reporting.', icon: 'anon' },
]

// ============================================================================
// Answer-derived intelligence
// Findings, the 24-month Capacity Plan, and Implementation Evidence are all
// computed live from the maturity scores the user actually enters in the
// Assessment Wizard - there is no static finding list in the live workspace.
// ============================================================================

export interface DerivedFinding {
  id: string
  qId: string
  topic: string
  domain: string
  tier: number
  severity: 'Critical' | 'High' | 'Moderate'
  score: number
  question: string
  description: string
  mitigation: string
  owner: string
  dueMonth: number
  dueDate: string
  /** Set by the suggested timeline (cipTimeline.ts). */
  actionType?: import('./cipTimeline.ts').ActionType
  minWeeks?: number
  startWeek?: number
  dueWeek?: number
  phase?: 1 | 2 | 3
  flags?: string[]
}

// Accountable owner inferred from the question's domain.
const OWNER_BY_DOMAIN: Record<string, string> = {
  'Governance & Leadership': 'Board Secretary',
  'Legal & Regulatory': 'Legal Counsel',
  'Strategy & Planning': 'Director, Strategy',
  'Human Resources': 'Head of Human Resources',
  'Sustainability & Financing': 'Director, Resource Mobilization',
  'Financial Management': 'Head of Finance',
  'Procurement & Supply Chain': 'Head of Procurement',
  'Risk & Internal Controls': 'Head of Risk & Controls',
  'Audit & Assurance': 'Head of Internal Audit',
  'Ethics & Anti-Fraud': 'Ethics & Compliance Officer',
  'Grant Management': 'Director, Programmes',
  'Program & Project Mgmt': 'Head of Programmes',
  'Monitoring, Evaluation & Learning': 'Head of M&E',
  'Partnerships & Stakeholders': 'Head of Partnerships',
  'USG Compliance': 'Donor Compliance Manager',
  'International Donor Compliance': 'Donor Compliance Manager',
  'Digital Systems & Cyber': 'Head of ICT',
  'Emergency Preparedness': 'Emergency Preparedness Coordinator',
  'Research & Innovation': 'Head of Research',
  'PMO & Delivery': 'Head of PMO',
}

export function severityFromScore(score: number): DerivedFinding['severity'] {
  if (score <= 1) return 'Critical'
  if (score === 2) return 'High'
  return 'Moderate'
}

export function quarterLabel(month: number): string {
  return `Q${Math.ceil(month / 3)}, Month ${month}`
}

// --- Capacity Development Plan length (self-determinable, see CIPPage) -----
// The plan used to be a fixed 24-month window. It's now the user's own call,
// within a sane range - a 1-month turnaround plan and a 20-year plan are both
// nonsensical to schedule against.
export const CIP_PLAN_MONTHS_MIN = 1
export const CIP_PLAN_MONTHS_MAX = 60
export const CIP_PLAN_MONTHS_DEFAULT = 24
export const CIP_PLAN_MONTHS_PRESETS = [6, 12, 18, 24, 36] as const

export function clampPlanMonths(months: number): number {
  if (Number.isNaN(months)) return CIP_PLAN_MONTHS_DEFAULT
  return Math.min(CIP_PLAN_MONTHS_MAX, Math.max(CIP_PLAN_MONTHS_MIN, Math.round(months)))
}

// Splits a plan of any length into three proportional severity bands, keeping
// the same ~22% / ~35% / ~43% split the original fixed 24-month plan used
// (Critical 2–6, High 7–14, Moderate 15–24 out of 24), collapsing gracefully
// toward month 1 for very short plans so every band still gets at least one
// month and nothing is ever scheduled past the plan's own end.
function planBands(planMonths: number): Record<DerivedFinding['severity'], [number, number]> {
  const n = clampPlanMonths(planMonths)
  const criticalEnd = Math.min(n, Math.max(1, Math.round(n * 0.25)))
  const highStart = Math.min(n, criticalEnd + 1)
  const highEnd = Math.max(highStart, Math.min(n, Math.round(n * 0.58)))
  const moderateStart = Math.min(n, highEnd + 1)
  return {
    Critical: [1, criticalEnd],
    High: [highStart, highEnd],
    Moderate: [moderateStart, n],
  }
}

// Schedule each gap into the plan window: the more critical the gap, the
// earlier it is due, spread across its band so items don't all land on the
// same month.
export function dueMonthFor(severity: DerivedFinding['severity'], index: number, planMonths: number): number {
  const [start, end] = planBands(planMonths)[severity]
  const width = end - start + 1
  return start + (index % width)
}

// Build the findings register from the answers provided. Only questions that
// have actually been answered (a key exists in `orgScores`) and scored at or
// below `threshold` (default 2) are surfaced as gaps requiring action.
// `planMonths` is the user-chosen plan length (default 24, see
// CIP_PLAN_MONTHS_DEFAULT) - every due date is scheduled to fit inside it.
export function deriveFindings(
  orgScores: Record<string, number>,
  threshold = 2,
  planMonths: number = CIP_PLAN_MONTHS_DEFAULT,
): DerivedFinding[] {
  const sevOrder: Record<DerivedFinding['severity'], number> = { Critical: 0, High: 1, Moderate: 2 }
  const findings: DerivedFinding[] = []
  let i = 0
  for (const q of MOCK_QUESTIONS) {
    if (!(q.id in orgScores) || !hasText(q)) continue
    const score = orgScores[q.id]
    if (score > threshold) continue
    const severity = severityFromScore(score)
    const dueMonth = dueMonthFor(severity, i, planMonths)
    findings.push({
      id: q.id,
      qId: q.id,
      topic: q.riskCategory || q.domain,
      domain: q.domain,
      tier: q.tier,
      severity,
      score,
      question: q.question,
      description: q.insight || q.question,
      mitigation: q.capacityAction,
      owner: OWNER_BY_DOMAIN[q.domain] ?? 'Executive Director',
      dueMonth,
      dueDate: quarterLabel(dueMonth),
    })
    i++
  }
  return findings.sort(
    (a, b) => sevOrder[a.severity] - sevOrder[b.severity] || a.dueMonth - b.dueMonth || a.tier - b.tier,
  )
}

// Implementation Evidence (0–100): share of answered controls that are actually
// implemented or system-enforced (score ≥ 4). Reflects execution, not paper.
export function computeImplementationEvidence(orgScores: Record<string, number>): number {
  const keys = Object.keys(orgScores).filter(isCoreScoreKey)
  if (keys.length === 0) return 0
  const enforced = keys.filter(k => orgScores[k] >= 4).length
  return Math.round((enforced / keys.length) * 100)
}

// Number of questions the user has actually answered.
export function answeredCount(orgScores: Record<string, number>): number {
  return Object.keys(orgScores).filter(isCoreScoreKey).length
}

// --- Interactive user guide ------------------------------------------------
// The full, step-by-step walkthrough rendered on /guide and exported as a
// self-contained downloadable document. Content is data-driven so the same
// source powers the in-app interactive view and the offline HTML/PDF export.
export const USER_GUIDE_VERSION = 'v4.0'
export const USER_GUIDE_UPDATED = 'July 2026'

export interface GuideStep {
  heading: string
  detail: string
  tip?: string
}

export interface GuideSection {
  id: string
  // Icon key resolved to a lucide glyph in the UserGuidePage; kept as a string
  // here so the data layer stays free of React/JSX imports.
  icon: 'rocket' | 'building' | 'clipboard' | 'gauge' | 'target' | 'folder' | 'report' | 'network' | 'shield' | 'lock' | 'life-buoy'
  title: string
  summary: string
  // View levels this section is most relevant to. Used by the role filter; a
  // section listing all four levels shows for everyone.
  roles: ViewLevel[]
  steps: GuideStep[]
}

const ALL_ROLES: ViewLevel[] = ['assessor', 'independent', 'portfolio', 'admin']

export const USER_GUIDE: GuideSection[] = [
  {
    id: 'getting-started',
    icon: 'rocket',
    title: 'Getting started & signing in',
    summary: 'Create your account, confirm your email, and choose how you sign in.',
    roles: ALL_ROLES,
    steps: [
      {
        heading: 'Register your institution',
        detail:
          'On the sign-in screen, switch to the Register tab. Enter your institution name, choose the category you are registering as (Organization Assessor, Independent Assessor or Portfolio Reviewer), give a work email, and set a password of at least 6 characters. Administrator access is never self-serve - it is granted only from the admin portal.',
      },
      {
        heading: 'Confirm your email',
        detail:
          'Unless your site has autoconfirm switched on, you will receive a confirmation link by email. Click it to activate your account; you cannot sign in until the email is confirmed. If it does not arrive, check your spam folder or register again to resend the link.',
        tip: 'The confirmation link signs you straight in and drops you into your workspace - no need to return to the login form manually.',
      },
      {
        heading: 'Sign in with email or a social provider',
        detail:
          'Enter your email and password to sign in. If your organization has enabled Google or GitHub single sign-on, a "continue with" button also appears beneath the form. CRAFT checks the live provider configuration on load, so a social button is only ever shown when that provider is actually enabled and able to complete a sign-in.',
        tip: 'Password, Google and GitHub all resolve to your account’s primary email, so any method lands you in the same workspace.',
      },
      {
        heading: 'Explore without an account',
        detail:
          'Not ready to register? Choose View Live Demo to open pre-loaded sample institutions and portfolios in a separate space. Nothing in the demo touches your real vault.',
      },
    ],
  },
  {
    id: 'onboarding',
    icon: 'building',
    title: 'Onboarding your workspace',
    summary: 'Tell CRAFT what kind of institution you are so it can tailor the assessment.',
    roles: ['assessor', 'independent', 'portfolio'],
    steps: [
      {
        heading: 'Name your workspace and pick an archetype',
        detail:
          'Choose the archetype that matches your legal form and mandate: Public Sector (ministries, agencies, regulators, NPHIs), Civil Society (NGOs, foundations, cooperatives, faith-based bodies) or Private Sector (SMEs, startups, corporates). A universal fiduciary core applies to all three; archetype-specific questions are layered on top.',
      },
      {
        heading: 'Select sector, subsector and country',
        detail:
          'Your sector and subsector sharpen the Data Room checklist so CRAFT asks for exactly the regulatory evidence your kind of institution must hold. Your country aligns national regulatory references.',
      },
      {
        heading: 'Map your donor frameworks',
        detail:
          'Pick the funders that matter to you - USAID / 2 CFR 200, the Global Fund, the World Bank, Gavi, EU / DEVCO (PAGoDA). CRAFT cross-references your answers against each so your findings speak directly to those donors’ standards.',
      },
      {
        heading: 'Switch on thematic lenses (optional)',
        detail:
          'Activate optional question packs that reflect your mandate - Climate/ESG & Article 6, Emergency & Health Security, or Research, Data & Innovation. Lenses add targeted questions without changing your Core baseline.',
      },
    ],
  },
  {
    id: 'assessment',
    icon: 'clipboard',
    title: 'Completing the assessment',
    summary: 'Work through the five tiers, scoring each control on a 0–5 maturity scale.',
    roles: ['assessor', 'independent'],
    steps: [
      {
        heading: 'Understand the five tiers',
        detail:
          'Questions are organised into five tiers: Organizational Maturity, Fiduciary Assurance, Grant Management, Donor & USG Readiness, and Digital & Operational Readiness. Work through them in order; each question carries an insight explaining why it matters.',
      },
      {
        heading: 'Score each control 0–5',
        detail:
          '0 = no evidence the control exists; 1 = ad-hoc or informal; 2 = documented but not consistently applied; 3 = applied but not independently verified; 4 = implemented and monitored; 5 = fully system-enforced with audit trails. Scores of 0–2 are treated as gaps.',
        tip: 'You do not have to answer everything at once - your dashboard, findings and capacity plan build only from what you have actually scored, so results fill in progressively.',
      },
      {
        heading: 'Record the 7-Point Evidence Matrix',
        detail:
          'Beneath each question, note where the control sits on the implementation ladder: No Evidence → Drafted → Approved → Disseminated → Partially Implemented → Implemented → System-Enforced. This captures execution maturity, not just whether a policy exists on paper.',
      },
      {
        heading: 'Import existing scores (optional)',
        detail:
          'Use Bulk Import in the wizard to upload a single CRAFT template file under 5MB. It is scanned, sanitized and validated, and each row is written into your vault exactly as if you had entered it by hand.',
      },
    ],
  },
  {
    id: 'scoring',
    icon: 'gauge',
    title: 'Scores, evidence & accreditation',
    summary: 'How your answers roll up into an A–E accreditation level.',
    roles: ALL_ROLES,
    steps: [
      {
        heading: 'Weighted composite score',
        detail:
          'Your answers roll up into a weighted composite across all domains, which maps to a raw accreditation level: A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, E below 40.',
      },
      {
        heading: 'Implementation Evidence',
        detail:
          'This is the share of your answered questions scoring 4 or higher - controls that are genuinely implemented or system-enforced. It updates live as you complete the wizard.',
      },
      {
        heading: 'The Paper Compliance Penalty',
        detail:
          'When Implementation Evidence falls below 50%, your accreditation is mathematically capped at Level C regardless of how strong your policy manuals look. CRAFT rewards execution, not documentation - so two institutions with identical paper scores can land on different levels.',
        tip: 'Prioritise moving controls from "documented" to "implemented and monitored" to lift the penalty cap.',
      },
    ],
  },
  {
    id: 'findings',
    icon: 'target',
    title: 'Findings & the Capacity Plan',
    summary: 'Turn gaps into a costed, owned, time-bound plan on a timeframe you choose.',
    roles: ['assessor', 'independent', 'portfolio'],
    steps: [
      {
        heading: 'From answers to findings',
        detail:
          'Every question scored 2 or below becomes a finding, classified Critical (0–1) or High (2). Findings appear automatically in your Findings register as you score.',
      },
      {
        heading: 'The Capacity Plan',
        detail:
          'Each finding is converted into a costed, owned, time-bound action. Owners are assigned from the question’s domain and due dates are scheduled by severity - critical gaps front-loaded earliest - rescaled to fit whatever plan length you choose (default 24 months, adjustable from the Capacity Plan page).',
      },
      {
        heading: 'Track execution',
        detail:
          'Set each action’s status: To-be-Initiated, In-Progress, On-Track, Off-Track, Completed-Validated or Completed-Invalidated. The dashboard summarises how many actions are off-track so leadership can intervene early.',
      },
    ],
  },
  {
    id: 'data-room',
    icon: 'folder',
    title: 'Data Room & evidence',
    summary: 'Your dynamic evidence vault, generated from your profile.',
    roles: ['assessor', 'independent'],
    steps: [
      {
        heading: 'A checklist tailored to you',
        detail:
          'Based on your archetype, sector, subsector and country, CRAFT generates the exact list of regulatory and fiduciary documents your institution should hold.',
      },
      {
        heading: 'Track each document',
        detail:
          'Every item is tracked as Missing, Uploaded, Verified or Flagged. Wizard questions can link directly to the Data Room item that satisfies their evidence, so your readiness score and your document trail stay in sync.',
      },
    ],
  },
  {
    id: 'reports',
    icon: 'report',
    title: 'Reports & exports',
    summary: 'Board- and donor-ready outputs built from your own answers.',
    roles: ALL_ROLES,
    steps: [
      {
        heading: 'Executive Summary (PDF)',
        detail:
          'The Reports Export Center generates a board-ready Executive Summary with your accreditation level, domain scores and headline findings.',
      },
      {
        heading: 'Capacity Plan (Excel/CSV)',
        detail:
          'Export the full 24-Month Capacity Plan with owners, due dates, mitigation actions and statuses for offline tracking or donor submission.',
      },
    ],
  },
  {
    id: 'portfolio',
    icon: 'network',
    title: 'Reviewing a portfolio',
    summary: 'Compare readiness across an assigned set of institutions.',
    roles: ['portfolio', 'admin'],
    steps: [
      {
        heading: 'See only your portfolio',
        detail:
          'A Portfolio Reviewer sees only the institutions explicitly assigned to their portfolio. Multi-tenant isolation is enforced by organization_id, so records outside the portfolio stay invisible.',
      },
      {
        heading: 'The Portfolio Admin portal',
        detail:
          'Compare accreditation levels and readiness trends across institutions, and reconcile self-assessments against independent reviews on the Trust Delta screen.',
      },
    ],
  },
  {
    id: 'admin',
    icon: 'shield',
    title: 'Administrator controls',
    summary: 'Administer your institution or consultancy: onboard institutions, manage your team and access.',
    roles: ['admin', 'portfolio'],
    steps: [
      {
        heading: 'Onboard and administer institutions',
        detail:
          'As an Administrator you register the institutions you run or consult for, curate portfolios, and open any client you administer read-only from the workspace switcher. Your reach is scoped to what you administer - other tenants stay isolated.',
      },
      {
        heading: 'Manage your team and access',
        detail:
          'Assign colleagues and consultants to your organisation, set their view levels, and grant or revoke cross-tenant access. Platform-wide configuration - the question bank, global domain weights and the cross-tenant audit log - is reserved for the platform operator and is not part of this role.',
      },
    ],
  },
  {
    id: 'security',
    icon: 'lock',
    title: 'Security, roles & sessions',
    summary: 'How your data is isolated and your session protected.',
    roles: ALL_ROLES,
    steps: [
      {
        heading: 'Multi-tenant isolation',
        detail:
          'Every record is scoped by organization_id. You can only read and write scores belonging to your own workspace, and an append-only audit log records activity from your first sign-in for a tamper-evident history.',
      },
      {
        heading: 'Idle session timeout',
        detail:
          'You can set an idle-logout window between 5 and 60 minutes in Settings. The session timer signs you out automatically after inactivity so an unattended session cannot stay open indefinitely.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    icon: 'life-buoy',
    title: 'Troubleshooting sign-in',
    summary: 'What to do when a social login or confirmation link misbehaves.',
    roles: ALL_ROLES,
    steps: [
      {
        heading: 'A social button is missing',
        detail:
          'Google and GitHub buttons only appear when that provider is enabled for the site under Identity → External providers. If GitHub is not showing, it has not been enabled yet - an administrator can switch it on, after which the button appears automatically. Email-and-password sign-in is always available.',
      },
      {
        heading: 'GitHub sign-in fails after redirect',
        detail:
          'The most common cause is that GitHub did not share a verified email. Make sure your GitHub account has a verified, non-private primary email, then try again. If it keeps failing, sign in with your email and password instead.',
      },
      {
        heading: 'You never received the confirmation email',
        detail:
          'Check your spam folder. You can register again with the same email to resend the confirmation link. Sign-in stays blocked until the email is confirmed.',
      },
    ],
  },
]
