// Engagement methodologies: configuration records, not code paths. Each picks the capital-readiness ladder domains
// that matter (with weights), the thresholds and the conclusion wording, the key domains that must not be weak, the
// desk review documents to request and the report sections. Spec: craft-internal
// docs/superpowers/specs/2026-11-05-universal-assessment-rigour.md (§2 item 5, §3).
// A methodology conclusion is the reviewer's working conclusion for the engagement report. It is never an audit
// opinion or certification, and it is separate from the standard validation statement (src/lib/validationStatement.ts).
// Self-check: `node src/lib/methodologies.test.ts`.

export type Methodology = {
  id: string; name: string; purpose: string
  /** Ladder domain → weight. Domains not listed are left out of the conclusion. */
  weights: Record<string, number>
  /** Weighted average as a percentage of the maximum (5): at or above `ready` → conclusions[0]; at or above `conditional` → [1]; else [2]. */
  thresholds: { ready: number; conditional: number }
  conclusions: [string, string, string]
  /** Key domains: any scored below `floor` (0–5) caps the conclusion at the middle one. */
  keyDomains: string[]; floor: number
  /** Desk review documents to request (ids from src/lib/dataroom.ts). */
  evidence: string[]
  reportSections: string[]
}

const SECTIONS = ['Methodology and scope', 'Limitations', 'Risk profile', 'Findings (criteria, condition, cause, consequence)', 'Management response', 'Corrective action plan', 'Evidence register']
const ALL_GOV = ['Core Governance & Leadership', 'Transparent Governance & Reporting', 'Leadership Succession Planning', 'Legal Structure & Registration']
const FIN = ['Basic Financial Controls', 'Auditable Financial Records', 'Cash-Flow Visibility & Bankability', 'Financial Resilience & Reserves']

export const METHODOLOGIES: Methodology[] = [
  {
    id: 'g2g_readiness', name: 'Government-to-government (G2G) readiness',
    purpose: 'Whether a public body can receive and manage funds directly from a government funder through its own systems.',
    weights: { ...w(ALL_GOV, 2), ...w(FIN, 3), 'Data & Controls Maturity': 2, 'Institutional Depth & Systems': 2, 'Evidence of Delivery': 1, 'Operational & Crisis Continuity': 1 },
    thresholds: { ready: 70, conditional: 50 }, conclusions: ['Ready', 'Ready subject to conditions', 'Not yet ready'],
    keyDomains: ['Basic Financial Controls', 'Auditable Financial Records', 'Legal Structure & Registration'], floor: 3,
    evidence: ['UNI-LEG-01', 'UNI-FIN-01', 'UNI-FIN-04', 'UNI-FIN-05', 'UNI-FIN-06', 'UNI-ORG-02', 'UNI-ORG-03', 'UNI-GOV-02', 'PUB-GOV-01', 'PUB-GOV-02'],
    reportSections: SECTIONS,
  },
  {
    id: 'agency_review', name: 'Ministerial or agency review',
    purpose: 'How well a ministry or agency is governed and run against its mandate, for its oversight body or a reform programme.',
    weights: { ...w(ALL_GOV, 3), ...w(FIN, 2), 'Institutional Depth & Systems': 3, 'Evidence of Delivery': 3, 'Data & Controls Maturity': 2, 'Operational & Crisis Continuity': 1 },
    thresholds: { ready: 70, conditional: 50 }, conclusions: ['Effective', 'Partly effective', 'Not effective'],
    keyDomains: ['Core Governance & Leadership', 'Evidence of Delivery'], floor: 2,
    evidence: ['PUB-GOV-01', 'UNI-ORG-02', 'UNI-ORG-03', 'UNI-GOV-02', 'UNI-PRG-01', 'UNI-PRG-02', 'UNI-FIN-01'],
    reportSections: SECTIONS,
  },
  {
    id: 'enterprise_risk', name: 'Enterprise risk and control review',
    purpose: 'Whether the organisation’s risk management and internal controls are designed and working.',
    weights: { ...w(FIN, 3), 'Data & Controls Maturity': 3, 'Operational & Crisis Continuity': 2, 'Transparent Governance & Reporting': 2, 'Core Governance & Leadership': 1 },
    thresholds: { ready: 70, conditional: 50 }, conclusions: ['Controls effective', 'Controls need improvement', 'Controls ineffective'],
    keyDomains: ['Basic Financial Controls', 'Data & Controls Maturity'], floor: 3,
    evidence: ['UNI-FIN-04', 'UNI-FIN-05', 'UNI-FIN-01', 'UNI-GOV-03', 'UNI-HR-02'],
    reportSections: SECTIONS,
  },
  {
    id: 'grant_readiness', name: 'Grant readiness (civil society)',
    purpose: 'Whether a civil society organisation is ready to receive and account for a grant.',
    weights: { ...w(FIN, 3), 'Legal Structure & Registration': 2, 'Core Governance & Leadership': 2, 'Evidence of Delivery': 2, 'Community Legitimacy': 2, 'Replicability & Partnerships': 1 },
    thresholds: { ready: 65, conditional: 45 }, conclusions: ['Ready', 'Ready with conditions', 'Not yet ready'],
    keyDomains: ['Basic Financial Controls', 'Legal Structure & Registration'], floor: 2,
    evidence: ['UNI-LEG-01', 'CS-LEG-01', 'UNI-FIN-01', 'UNI-FIN-04', 'UNI-FIN-06', 'CS-HR-01', 'UNI-PRG-01', 'UNI-PRG-02'],
    reportSections: SECTIONS,
  },
  {
    id: 'governance_esg', name: 'Governance and ESG review',
    purpose: 'How the organisation is governed and manages environmental, social and governance matters.',
    weights: { ...w(ALL_GOV, 3), 'Environmental & Resource Performance': 3, 'Social Value & Human Capital': 3, 'Sustainability-Linked / Green Finance Readiness': 1, 'Community Legitimacy': 1 },
    thresholds: { ready: 70, conditional: 50 }, conclusions: ['Strong', 'Developing', 'Weak'],
    keyDomains: ['Core Governance & Leadership', 'Transparent Governance & Reporting'], floor: 2,
    evidence: ['UNI-GOV-01', 'UNI-GOV-02', 'UNI-GOV-03', 'UNI-HR-03', 'UNI-PRG-03'],
    reportSections: SECTIONS,
  },
  {
    id: 'transformation_readiness', name: 'Transformation readiness',
    purpose: 'Whether the organisation can carry a major reform, restructuring or new system through.',
    weights: { 'Core Governance & Leadership': 3, 'Leadership Succession Planning': 2, 'Institutional Depth & Systems': 3, 'Data & Controls Maturity': 2, 'Operational & Crisis Continuity': 2, 'Social Value & Human Capital': 2, 'Financial Resilience & Reserves': 1 },
    thresholds: { ready: 65, conditional: 45 }, conclusions: ['Ready', 'Ready with conditions', 'Not yet ready'],
    keyDomains: ['Core Governance & Leadership', 'Institutional Depth & Systems'], floor: 2,
    evidence: ['UNI-ORG-02', 'UNI-ORG-03', 'UNI-GOV-02', 'UNI-RES-01'],
    reportSections: SECTIONS,
  },
]

function w(domains: string[], weight: number): Record<string, number> {
  return Object.fromEntries(domains.map((d) => [d, weight]))
}

export const methodologyById = (id: string | undefined) => METHODOLOGIES.find((m) => m.id === id)

export type MethodologyResult = { percent: number; conclusion: string; scoredDomains: number; missingDomains: string[]; weakKeyDomains: string[] }

/**
 * The working conclusion from final indicator scores (0–5, per domain). Domains with no final score are listed as
 * missing (a limitation) and left out of the average. With nothing scored, the conclusion is the lowest.
 */
export function methodologyConclusion(m: Methodology, scores: { domain: string; final: number | null }[]): MethodologyResult {
  const byDomain = new Map<string, number[]>()
  for (const s of scores) if (s.final != null && m.weights[s.domain]) byDomain.set(s.domain, [...(byDomain.get(s.domain) ?? []), s.final])
  let num = 0, den = 0
  for (const [d, vals] of byDomain) { const avg = vals.reduce((a, b) => a + b, 0) / vals.length; num += avg * m.weights[d]; den += m.weights[d] }
  const percent = den ? Math.round((num / den / 5) * 100) : 0
  const weakKeyDomains = m.keyDomains.filter((d) => (byDomain.get(d) ?? []).some((v) => v < m.floor))
  let idx = percent >= m.thresholds.ready ? 0 : percent >= m.thresholds.conditional ? 1 : 2
  if (idx === 0 && weakKeyDomains.length) idx = 1
  return { percent, conclusion: m.conclusions[idx], scoredDomains: byDomain.size, missingDomains: Object.keys(m.weights).filter((d) => !byDomain.has(d)), weakKeyDomains }
}

export type ReportIndicator = { final: number | null; self?: number | null; sufficiency?: string | null; comment?: string; qualifications?: string[] }

/**
 * The findings for an engagement report: indicators where the validator wrote a finding, the evidence fell short,
 * the final score is below the self-assessment, or a qualification names the indicator.
 */
export function reportFindings<T extends ReportIndicator>(rows: T[]): T[] {
  return rows.filter((i) => !!i.comment?.trim() || (!!i.sufficiency && i.sufficiency !== 'sufficient') || (i.final != null && i.self != null && i.final < i.self) || !!i.qualifications?.length)
}
