// ============================================================================
// CRAFT (ICARF v4.0) - Institutional & Financial Oversight Framework Registry
// ----------------------------------------------------------------------------
// This module is the single source of truth for the world-leading capacity and
// fiduciary frameworks the platform integrates explicitly:
//   • Pact OMT v6 (Organizational Mapping Tool, Dec 2025) - 4-level Statements of
//     Excellence (Minimal / Basic / Moderate / Strong).
//   • Pact OCA/OPI - 1–4 maturity scale (Embryonic → Mature) + 4 performance
//     domains for the Organizational Performance Index radar.
//   • Global Fund PR Reporting Handbook - the FCR financial reporting tabs, the
//     cash-reconciliation triangulation control, and PC/PU/PUDR/FCR cycles.
//   • G7 / OECD AI Governance - the 5-dimension classification, the evaluation
//     matrix (C-CORE, CASTER, Alpha/GoZero) and the UNESCO ethical-impact checks.
//   • GFA Business Diagnostic - the 7-pillar private-sector / DFI readiness model.
//
// Everything here is pure data + helpers (no React) so any page can import it.
// ============================================================================

export type FrameworkId =
  | 'pact-omt-v6'
  | 'oca-opi'
  | 'gf-pr-fcr'
  | 'g7-ai-public-sector'
  | 'oecd-ai'
  | 'gfa-diagnostic'
  | 'esg-self-assessment'

// Visual theme per framework - financial/compliance work stays in the DiBadili
// emerald palette; AI ethics switches to indigo to separate "tech ethics" from
// "financial compliance"; independent-assurance surfaces use slate (audit mode).
export type FrameworkTheme = 'emerald' | 'indigo' | 'slate' | 'amber'

export type ScaleType = 'fiduciary-0-5' | 'omt-1-4' | 'oca-1-4'

export interface FrameworkMeta {
  id: FrameworkId
  name: string
  short: string
  authority: string
  scale: ScaleType
  theme: FrameworkTheme
  blurb: string
  /** Lucide icon name, resolved by the page via a small icon map. */
  icon: string
}

export const FRAMEWORKS: FrameworkMeta[] = [
  {
    id: 'pact-omt-v6',
    name: 'Pact Organizational Mapping Tool (OMT v6)',
    short: 'OMT v6',
    authority: "Pact · OMT v6 (Dec 2025)",
    scale: 'omt-1-4',
    theme: 'emerald',
    blurb:
      'Facilitated organizational capacity mapping using the exact 4-level Statements of Excellence (Minimal · Basic · Moderate · Strong).',
    icon: 'Network',
  },
  {
    id: 'oca-opi',
    name: 'Pact OCA / Organizational Performance Index (OPI)',
    short: 'OCA / OPI',
    authority: 'Pact · OCA/OPI Maturity Scale',
    scale: 'oca-1-4',
    theme: 'emerald',
    blurb:
      '1–4 maturity scoring (Embryonic → Mature) with Statements of Excellence and the 4-domain Organizational Performance Index.',
    icon: 'Radar',
  },
  {
    id: 'gf-pr-fcr',
    name: 'Global Fund PR - Financial Compliance Reporting (FCR)',
    short: 'GF PR FCR',
    authority: 'The Global Fund · PR Reporting Handbook',
    scale: 'fiduciary-0-5',
    theme: 'emerald',
    blurb:
      'The exact PR financial reporting tabs - cash reconciliation, commitments, SR cash and triangulation controls - with data-quality validation.',
    icon: 'Banknote',
  },
  {
    id: 'g7-ai-public-sector',
    name: 'G7 AI Governance - Public Sector Toolkit',
    short: 'G7 AI',
    authority: 'G7 / OECD · AI Governance Framework',
    scale: 'fiduciary-0-5',
    theme: 'indigo',
    blurb:
      'The 5-dimension AI assessment with the evaluation matrix (C-CORE, CASTER, Alpha/GoZero) and fully-completed-survey consistency scoring.',
    icon: 'Cpu',
  },
  {
    id: 'oecd-ai',
    name: 'OECD / UNESCO AI Classification & Ethical Impact',
    short: 'OECD AI',
    authority: 'OECD / UNESCO · AI Principles',
    scale: 'fiduciary-0-5',
    theme: 'indigo',
    blurb:
      'Step-by-step 5-dimension AI system classification plus the UNESCO Ethical Impact Assessment gate before deployment approval.',
    icon: 'ShieldCheck',
  },
  {
    id: 'gfa-diagnostic',
    name: 'GFA Business Diagnostic (Private Sector / DFI)',
    short: 'GFA Diagnostic',
    authority: 'GFA · Investment Readiness Diagnostic',
    scale: 'fiduciary-0-5',
    theme: 'amber',
    blurb:
      'The 7-pillar investment-readiness scorecard and the DFI/PE data-room document requests for private-sector archetypes.',
    icon: 'TrendingUp',
  },
  {
    id: 'esg-self-assessment',
    name: 'ESG Self-Assessment',
    short: 'ESG',
    authority: 'CRAFT · ESG Self-Assessment (GRI / IFRS S1-S2 / TCFD-aligned)',
    scale: 'fiduciary-0-5',
    theme: 'emerald',
    blurb:
      'Score Environmental, Social and Governance performance against response and verified evidence, surface gaps and recommendations, and earn a letter-band ESG rating badge for financing, investment, procurement and sustainability-reporting readiness.',
    icon: 'Leaf',
  },
]

export function getFramework(id: string | undefined): FrameworkMeta | undefined {
  return FRAMEWORKS.find(f => f.id === id)
}

// ----------------------------------------------------------------------------
// Maturity scales
// ----------------------------------------------------------------------------

export interface ScaleLevel {
  value: number
  label: string
  /** Generic anchor describing this level (the question-agnostic definition). */
  anchor: string
  /** Tailwind classes for chips/badges at this level. */
  badge: string
  /** Bar / accent fill class. */
  fill: string
}

// Pact OMT v6 - the exact 4-level scale.
export const OMT_LEVELS: ScaleLevel[] = [
  { value: 1, label: 'Minimal', anchor: 'Systems and practices do not meet the basic needs of the organization.', badge: 'bg-rose-100 text-rose-700 border-rose-300', fill: 'bg-rose-500' },
  { value: 2, label: 'Basic', anchor: 'Systems mostly meet basic needs but are outdated and frequently break down.', badge: 'bg-amber-100 text-amber-700 border-amber-300', fill: 'bg-amber-500' },
  { value: 3, label: 'Moderate', anchor: 'Systems allow the organization to function optimally and are periodically reviewed.', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', fill: 'bg-emerald-400' },
  { value: 4, label: 'Strong', anchor: 'Systems are regularly reviewed and updated to meet evolving needs.', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', fill: 'bg-emerald-600' },
]

// Pact OCA / OPI - 1–4 maturity.
export const OCA_LEVELS: ScaleLevel[] = [
  { value: 1, label: 'Embryonic', anchor: 'No formal systems; ad-hoc approaches.', badge: 'bg-rose-100 text-rose-700 border-rose-300', fill: 'bg-rose-500' },
  { value: 2, label: 'Developing', anchor: 'Systems documented but not consistently applied.', badge: 'bg-amber-100 text-amber-700 border-amber-300', fill: 'bg-amber-500' },
  { value: 3, label: 'Established', anchor: 'Systems consistently applied and monitored.', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', fill: 'bg-emerald-400' },
  { value: 4, label: 'Mature', anchor: 'Systems optimized, independently verified, and driving strategic adaptation.', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', fill: 'bg-emerald-600' },
]

// Standard fiduciary 0–5 scale (the platform baseline).
export const FIDUCIARY_LEVELS: ScaleLevel[] = [
  { value: 0, label: 'Absent', anchor: 'No evidence of the control or practice.', badge: 'bg-rose-100 text-rose-700 border-rose-300', fill: 'bg-rose-600' },
  { value: 1, label: 'Initial', anchor: 'Ad-hoc, undocumented, reactive.', badge: 'bg-rose-100 text-rose-700 border-rose-300', fill: 'bg-rose-500' },
  { value: 2, label: 'Developing', anchor: 'Documented but inconsistently applied.', badge: 'bg-amber-100 text-amber-700 border-amber-300', fill: 'bg-amber-500' },
  { value: 3, label: 'Defined', anchor: 'Consistently applied and monitored.', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', fill: 'bg-yellow-400' },
  { value: 4, label: 'Managed', anchor: 'Measured, reviewed and continuously improved.', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', fill: 'bg-emerald-400' },
  { value: 5, label: 'Optimized', anchor: 'Independently verified, best-practice and sustained.', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', fill: 'bg-emerald-600' },
]

export function levelsForScale(scale: ScaleType): ScaleLevel[] {
  if (scale === 'omt-1-4') return OMT_LEVELS
  if (scale === 'oca-1-4') return OCA_LEVELS
  return FIDUCIARY_LEVELS
}

export function scaleMax(scale: ScaleType): number {
  return scale === 'fiduciary-0-5' ? 5 : 4
}

// ----------------------------------------------------------------------------
// Rubric questions with per-level Statements of Excellence (SoE)
// ----------------------------------------------------------------------------

export interface RubricQuestion {
  id: string
  domain: string
  question: string
  /** Statement of Excellence for each score level keyed by the numeric value. */
  soe: Record<number, string>
  /** Evidence the assessor should expect for a high score. */
  evidence?: string
}

// Pact OMT v6 - uses the exact Statements of Excellence from the OMT document.
export const OMT_QUESTIONS: RubricQuestion[] = [
  {
    id: 'OMT-TECH-01',
    domain: 'Technology & Information Systems',
    question: 'Technology and information systems meet the needs of the organization.',
    soe: {
      1: 'Technology and information systems do not meet basic needs of the organization.',
      2: 'Systems mostly meet basic needs but are outdated and frequently break down.',
      3: 'Technology allows the organization to function optimally. Systems are periodically reviewed.',
      4: 'Systems are regularly reviewed and updated to meet evolving needs.',
    },
    evidence: 'IT asset register, systems review schedule, helpdesk logs',
  },
  {
    id: 'OMT-HR-01',
    domain: 'Human Resources',
    question: 'Job descriptions are documented and roles and responsibilities are delineated.',
    soe: {
      1: 'Job descriptions are not documented and roles and responsibilities are not delineated.',
      2: 'Job descriptions exist but are outdated and no longer accurate. Staff express confusion.',
      3: 'Job descriptions are occasionally updated, but staff wish for greater clarity.',
      4: 'Job descriptions are accurate, updated, and staff are clear on roles and responsibilities.',
    },
    evidence: 'Signed job descriptions, organogram, staff handbook',
  },
  {
    id: 'OMT-GOV-01',
    domain: 'Governance',
    question: 'The governing body provides effective strategic oversight and accountability.',
    soe: {
      1: 'No functioning governing body; oversight is absent or purely nominal.',
      2: 'A governing body exists but meets irregularly and rarely reviews performance.',
      3: 'The governing body meets regularly and reviews performance, with some gaps in follow-through.',
      4: 'The governing body provides robust, documented oversight and holds management accountable against strategy.',
    },
    evidence: 'Board charter, minutes, performance review records',
  },
  {
    id: 'OMT-FIN-01',
    domain: 'Financial Management',
    question: 'Financial management systems produce timely, accurate and useful information.',
    soe: {
      1: 'Financial systems do not meet basic needs; records are unreliable.',
      2: 'Systems mostly meet basic needs but are manual and error-prone.',
      3: 'Financial systems function well and reports are periodically reviewed for accuracy.',
      4: 'Financial systems are regularly reviewed, automated and produce decision-grade information.',
    },
    evidence: 'Chart of accounts, monthly management accounts, audit reports',
  },
  {
    id: 'OMT-ADMIN-01',
    domain: 'Administration',
    question: 'Administrative policies and procedures support efficient operations.',
    soe: {
      1: 'Administrative policies and procedures do not exist or are not followed.',
      2: 'Policies exist but are outdated and inconsistently applied.',
      3: 'Policies are followed and periodically reviewed for relevance.',
      4: 'Policies are regularly reviewed, well understood and consistently applied across the organization.',
    },
    evidence: 'Operations manual, procurement policy, asset register',
  },
  {
    id: 'OMT-MEL-01',
    domain: 'Monitoring, Evaluation & Learning',
    question: 'The organization measures results and uses evidence to improve programs.',
    soe: {
      1: 'No systematic measurement of results takes place.',
      2: 'Some data is collected but is not analyzed or used for decisions.',
      3: 'Results are measured and periodically reviewed to inform programming.',
      4: 'A robust MEL system drives continuous learning and adaptive management.',
    },
    evidence: 'MEL framework, indicator tracking table, learning reviews',
  },
]

// Pact OCA / OPI - includes the exact Resource Mobilization sample from the spec.
export const OCA_QUESTIONS: RubricQuestion[] = [
  {
    id: 'OCA-SUS-01',
    domain: 'Sustainability',
    question: 'The organization has a diversified funding base capable of sustaining its programs.',
    soe: {
      1: 'Organization has short-term one-off funding from only one source.',
      2: 'Organization has medium-term funding from one or more funders.',
      3: 'Organization has longer-term funding from more than one source.',
      4: 'Organization has long-term funding from >3 sources and actively seeks new resources.',
    },
    evidence: 'Funding pipeline, signed grant agreements, resource mobilization strategy',
  },
  {
    id: 'OCA-EFF-01',
    domain: 'Effectiveness',
    question: 'The organization achieves its intended results against defined standards.',
    soe: {
      1: 'No defined results or standards; achievement is unknown.',
      2: 'Results are defined but rarely achieved or measured against standards.',
      3: 'Results are consistently achieved and measured against standards.',
      4: 'Results are independently verified and exceed standards, sustained over time.',
    },
    evidence: 'Results framework, evaluation reports, independent verification',
  },
  {
    id: 'OCA-EFFI-01',
    domain: 'Efficiency',
    question: 'The organization delivers its programs with optimal use of resources and reach.',
    soe: {
      1: 'Delivery is ad-hoc with no view of cost-efficiency or reach.',
      2: 'Delivery is documented but cost-per-result and reach are not tracked.',
      3: 'Cost-efficiency and reach are tracked and reviewed periodically.',
      4: 'Efficiency is optimized, benchmarked externally and drives resource decisions.',
    },
    evidence: 'Unit-cost analysis, reach data, budget-vs-actual reports',
  },
  {
    id: 'OCA-REL-01',
    domain: 'Relevance',
    question: 'Programs remain relevant to the target population and the organization learns from them.',
    soe: {
      1: 'No mechanism to assess relevance to the target population.',
      2: 'Relevance is assumed; beneficiary feedback is collected sporadically.',
      3: 'Beneficiary feedback is collected and used to adjust programs.',
      4: 'Continuous learning and beneficiary voice systematically shape strategy.',
    },
    evidence: 'Needs assessments, feedback mechanisms, adaptation logs',
  },
]

export function rubricForFramework(id: FrameworkId): RubricQuestion[] {
  if (id === 'pact-omt-v6') return OMT_QUESTIONS
  if (id === 'oca-opi') return OCA_QUESTIONS
  return []
}

// OPI radar - the 4 Organizational Performance Index domains.
export const OPI_DOMAINS: { key: string; label: string; blurb: string }[] = [
  { key: 'Effectiveness', label: 'Effectiveness', blurb: 'Results & Standards' },
  { key: 'Efficiency', label: 'Efficiency', blurb: 'Delivery & Reach' },
  { key: 'Relevance', label: 'Relevance', blurb: 'Target Population & Learning' },
  { key: 'Sustainability', label: 'Sustainability', blurb: 'Resources & Social Capital' },
]

// ----------------------------------------------------------------------------
// Global Fund PR - Financial Compliance Reporting (FCR)
// ----------------------------------------------------------------------------

export interface FcrTab {
  id: string
  label: string
  blurb: string
}

// The exact left-hand navigation of the GF PR Handbook financial report.
export const FCR_TABS: FcrTab[] = [
  { id: 'expenditure', label: 'Expenditure Report', blurb: 'Actual vs Budget by cost category' },
  { id: 'cash-recon', label: 'Cash Reconciliation', blurb: 'PR-level cash balance adjustments' },
  { id: 'open-advances', label: 'Open Advances', blurb: 'Outstanding advances aging' },
  { id: 'commitments', label: 'Commitments & Obligations', blurb: 'Legal commitments vs cash spent' },
  { id: 'sr-cash', label: 'SR Cash Reconciliation', blurb: 'Sub-Recipient cash tracking' },
  { id: 'triangulation', label: 'Triangulation Controls', blurb: 'Cross-verification of all 3 streams' },
  { id: 'tax', label: 'Tax Reporting', blurb: 'VAT/GST compliance for grant funds' },
  { id: 'forecast', label: 'Forecast Report', blurb: 'Next-period cash requirements' },
  { id: 'disbursement', label: 'Disbursement Request', blurb: 'Based on the forecast' },
  { id: 'data-quality', label: 'Check Data Quality', blurb: 'Error / warning validation' },
]

export interface FcrLineRow {
  item: string
  label: string
  regular: number
  c19rm: number
}
export const fcrTotal = (r: FcrLineRow) => r.regular + r.c19rm

// PUDR-format cash reconciliation rows (Regular Funds + C19RM Funds).
export const CASH_RECON_ROWS: FcrLineRow[] = [
  { item: '1.1', label: 'Opening Cash Balance', regular: 1_250_000, c19rm: 320_000 },
  { item: '2.7', label: 'Total IP Income (disbursements received)', regular: 4_800_000, c19rm: 900_000 },
  { item: '3.6', label: 'Total IP Cash Outflows', regular: 4_120_000, c19rm: 760_000 },
  { item: '4.3', label: 'Total Reconciling Adjustments', regular: -15_000, c19rm: 0 },
  { item: '5.1', label: 'Total Cash Balance In-Country', regular: 1_915_000, c19rm: 460_000 },
]

// The actual bank statement balance the closing cash is triangulated against.
export const BANK_STATEMENT_BALANCE = { regular: 1_915_000, c19rm: 455_000 }

export interface TriangulationResult {
  expectedClosing: number
  actualBalance: number
  variance: number
  balanced: boolean
}

// Expected Closing = Opening + Income − Outflows + Adjustments, compared with the
// actual bank statement balance. Any non-zero variance must be justified in 13.10.
export function triangulate(rows: FcrLineRow[], actual: { regular: number; c19rm: number }): TriangulationResult {
  const get = (item: string) => {
    const r = rows.find(x => x.item === item)
    return r ? fcrTotal(r) : 0
  }
  const opening = get('1.1')
  const income = get('2.7')
  const outflows = get('3.6')
  const adjustments = get('4.3')
  const expectedClosing = opening + income - outflows + adjustments
  const actualBalance = actual.regular + actual.c19rm
  const variance = Math.round((expectedClosing - actualBalance) * 100) / 100
  return { expectedClosing, actualBalance, variance, balanced: variance === 0 }
}

export interface OpenAdvanceRow {
  party: string
  reference: string
  amount: number
  ageDays: number
}
export const OPEN_ADVANCES: OpenAdvanceRow[] = [
  { party: 'SR - Regional Health Network', reference: 'ADV-2026-014', amount: 180_000, ageDays: 42 },
  { party: 'Field Office (North)', reference: 'ADV-2026-021', amount: 64_500, ageDays: 95 },
  { party: 'Training Vendor - Apex Ltd', reference: 'ADV-2026-027', amount: 22_000, ageDays: 168 },
]
export const advanceBucket = (days: number) =>
  days <= 30 ? 'Current' : days <= 90 ? '31–90 days' : days <= 180 ? '91–180 days' : '180+ days (overdue)'

export interface CommitmentRow {
  category: string
  legalCommitment: number
  cashSpent: number
}
export const COMMITMENTS: CommitmentRow[] = [
  { category: 'Health Products & Equipment', legalCommitment: 2_400_000, cashSpent: 1_910_000 },
  { category: 'Human Resources', legalCommitment: 1_200_000, cashSpent: 1_140_000 },
  { category: 'Sub-Recipient Grants', legalCommitment: 1_800_000, cashSpent: 1_220_000 },
  { category: 'Travel & Training', legalCommitment: 420_000, cashSpent: 365_000 },
]

export interface SrCashRow {
  sr: string
  opening: number
  received: number
  spent: number
}
export const SR_CASH: SrCashRow[] = [
  { sr: 'Regional Health Network', opening: 120_000, received: 600_000, spent: 540_000 },
  { sr: 'Community Care Coalition', opening: 80_000, received: 420_000, spent: 410_000 },
  { sr: 'District Support Unit', opening: 45_000, received: 300_000, spent: 318_000 },
]
export const srClosing = (r: SrCashRow) => r.opening + r.received - r.spent

export interface ExpenditureRow {
  category: string
  budget: number
  actual: number
}
export const EXPENDITURE: ExpenditureRow[] = [
  { category: 'Health Products & Equipment', budget: 2_500_000, actual: 1_910_000 },
  { category: 'Human Resources', budget: 1_200_000, actual: 1_140_000 },
  { category: 'Sub-Recipient Grants', budget: 1_800_000, actual: 1_220_000 },
  { category: 'Travel & Training', budget: 500_000, actual: 365_000 },
  { category: 'Monitoring & Evaluation', budget: 350_000, actual: 280_000 },
  { category: 'Indirect / Overhead', budget: 300_000, actual: 312_000 },
]
export const variancePct = (budget: number, actual: number) =>
  budget === 0 ? 0 : Math.round(((actual - budget) / budget) * 1000) / 10

export interface TaxRow {
  type: string
  grossPaid: number
  recoverable: number
  recovered: number
}
export const TAX_ROWS: TaxRow[] = [
  { type: 'VAT on goods', grossPaid: 210_000, recoverable: 210_000, recovered: 168_000 },
  { type: 'VAT on services', grossPaid: 96_000, recoverable: 96_000, recovered: 96_000 },
  { type: 'Customs / import duty', grossPaid: 54_000, recoverable: 54_000, recovered: 0 },
]

// Mock GF data-quality validator replicating the Handbook's error/warning logic.
export interface DataQualityIssue {
  level: 'error' | 'warning'
  code: string
  message: string
}
export interface DataQualityResult {
  errors: number
  warnings: number
  issues: DataQualityIssue[]
}
export function checkDataQuality(): DataQualityResult {
  const issues: DataQualityIssue[] = [
    { level: 'error', code: 'C19RM-RECON', message: 'C19RM closing cash (460,000) does not match the bank statement balance (455,000). Triangulation variance of 5,000 must be justified in Item 13.10.' },
    { level: 'error', code: 'SR-NEG-CASH', message: 'District Support Unit shows a negative closing SR cash balance (27,000 overspent). Investigate before consolidation.' },
    { level: 'warning', code: 'ADV-AGING', message: 'Advance ADV-2026-027 is aged 168 days (>90). Provide a recovery plan.' },
    { level: 'warning', code: 'BUDGET-OVR', message: 'Indirect / Overhead actual exceeds budget by 4.0%. Confirm reprogramming approval.' },
    { level: 'warning', code: 'TAX-RECOV', message: 'Customs / import duty of 54,000 is recoverable but 0 has been recovered this period.' },
  ]
  return {
    errors: issues.filter(i => i.level === 'error').length,
    warnings: issues.filter(i => i.level === 'warning').length,
    issues,
  }
}

// ----------------------------------------------------------------------------
// G7 / OECD AI Governance
// ----------------------------------------------------------------------------

export interface AiDimension {
  key: string
  label: string
  blurb: string
  facets: string[]
}

// The 5-dimension framework (G7 Public Sector Toolkit / OECD classification).
export const AI_DIMENSIONS: AiDimension[] = [
  { key: 'people-planet', label: 'People & Planet', blurb: 'Social impact, human rights, environmental footprint', facets: ['Users & stakeholders', 'Human rights impact', 'Environmental footprint'] },
  { key: 'economic', label: 'Economic Context', blurb: 'Market readiness, ROI, cost-benefit', facets: ['Sector & business function', 'Criticality', 'ROI / cost-benefit'] },
  { key: 'data-input', label: 'Data & Input', blurb: 'Data quality, sovereignty, bias', facets: ['Provenance & structure', 'Privacy / anonymization', 'Bias & representativeness'] },
  { key: 'ai-model', label: 'AI Model', blurb: 'Architecture, explainability, robustness', facets: ['Symbolic vs statistical', 'Transparency & explainability', 'Robustness & evolution'] },
  { key: 'task-output', label: 'Task & Output', blurb: 'Evaluation metrics, automation, completed surveys', facets: ['Automation & action autonomy', 'Evaluation metrics', 'Fully completed surveys'] },
]

// The exact evaluation matrix metrics from the G7 toolkit.
export interface AiMetric {
  key: string
  label: string
  description: string
  /** 0–100 illustrative benchmark value. */
  benchmark: number
  unit: '%' | 'score' | 'count'
}
export const AI_EVAL_MATRIX: AiMetric[] = [
  { key: 'c-core', label: 'C-CORE Score', description: 'Consistency of Core Outputs across repeated runs', benchmark: 86, unit: '%' },
  { key: 'caster', label: 'CASTER', description: 'Categorical Assessment of System Trust & Ethics Rating', benchmark: 78, unit: 'score' },
  { key: 'alpha', label: 'Alpha Benchmark', description: 'Reference performance against the Alpha baseline', benchmark: 82, unit: '%' },
  { key: 'gozero', label: 'GoZero Benchmark', description: 'Drift / hallucination floor against the GoZero baseline', benchmark: 91, unit: '%' },
  { key: 'surveys', label: 'Fully Completed Surveys', description: 'Number of fully completed evaluation surveys', benchmark: 240, unit: 'count' },
]

// UNESCO-aligned Ethical Impact Assessment checklist - every item must be
// satisfied before AI deployment can be approved.
export interface EiaCheck {
  key: string
  label: string
  hint: string
}
export const EIA_CHECKLIST: EiaCheck[] = [
  { key: 'bias', label: 'Bias & Fairness Mitigation Plan', hint: 'Documented testing for disparate impact across protected groups.' },
  { key: 'explainability', label: 'Explainability & Transparency Mechanism', hint: 'Model cards and decision rationale available to affected parties.' },
  { key: 'human-loop', label: 'Human-in-the-Loop Oversight', hint: 'A human can review, override and halt automated decisions.' },
  { key: 'privacy', label: 'Data Privacy & Consent Verification', hint: 'Lawful basis, consent records and anonymization verified.' },
  { key: 'environment', label: 'Environmental Impact (Compute footprint)', hint: 'Training/inference compute footprint estimated and bounded.' },
]

// ----------------------------------------------------------------------------
// GFA Business Diagnostic - 7-pillar investment readiness
// ----------------------------------------------------------------------------

export interface GfaPillar {
  key: string
  label: string
  /** Illustrative readiness 0–100. */
  readiness: number
  docs: string[]
}
export const GFA_PILLARS: GfaPillar[] = [
  { key: 'cash', label: 'Cash Management & Runway', readiness: 72, docs: ['13-week cash flow forecast', 'Bank statements (6 months)', 'Runway model'] },
  { key: 'risk', label: 'Risk Management', readiness: 58, docs: ['Risk register', 'Insurance schedule', 'Business continuity plan'] },
  { key: 'controls', label: 'Financial Information & Controls', readiness: 64, docs: ['Management accounts', 'Audited financials', 'Accounting policies'] },
  { key: 'people', label: 'People Management', readiness: 51, docs: ['Org chart', 'Key-person contracts', 'HR policies'] },
  { key: 'governance', label: 'Governance', readiness: 67, docs: ['Cap table', 'Shareholder agreements', 'Board minutes'] },
  { key: 'impact', label: 'Impact Measurement', readiness: 45, docs: ['Theory of Change', 'ESG / safeguarding policy', 'Impact KPIs'] },
  { key: 'credibility', label: 'Project Credibility', readiness: 70, docs: ['Customer contracts', 'Pipeline / LOIs', 'Reference letters'] },
]

// ----------------------------------------------------------------------------
// Global Fund reporting cycles (PC / PU / PUDR / Final PU / FCR)
// ----------------------------------------------------------------------------

export type GfCycleType = 'PC' | 'PU' | 'PUDR' | 'Final PU' | 'FCR'

export interface GfCycleMeta {
  type: GfCycleType
  label: string
  cadence: string
  blurb: string
}
export const GF_CYCLE_META: Record<GfCycleType, GfCycleMeta> = {
  PC: { type: 'PC', label: 'Progress Concept', cadence: 'Pre-implementation', blurb: 'Concept note submitted before implementation begins.' },
  PU: { type: 'PU', label: 'Progress Update', cadence: 'Quarterly', blurb: 'Quarterly programmatic & financial progress update.' },
  PUDR: { type: 'PUDR', label: 'Progress Update & Disbursement Request', cadence: 'Semi-annual', blurb: 'Semi-annual update bundled with a disbursement request.' },
  'Final PU': { type: 'Final PU', label: 'Final Progress Update', cadence: 'End of grant', blurb: 'Closure report at the end of the grant.' },
  FCR: { type: 'FCR', label: 'Financial Compliance Report', cadence: 'Quarterly', blurb: 'Quarterly financial compliance reconciliation.' },
}

export type CycleStatus = 'on-track' | 'warning-90' | 'urgent-30' | 'overdue'

export interface ComplianceCycleItem {
  id: string
  type: GfCycleType
  title: string
  dueDate: string // ISO
  status: CycleStatus
}

export interface CycleStatusMeta {
  label: string
  emoji: string
  cls: string
  dot: string
}
export const CYCLE_STATUS_META: Record<CycleStatus, CycleStatusMeta> = {
  'on-track': { label: 'On Track', emoji: '🟢', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'warning-90': { label: '90-Day Warning', emoji: '🟡', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400' },
  'urgent-30': { label: '30-Day Urgent', emoji: '🟠', cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  overdue: { label: 'Overdue', emoji: '🔴', cls: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
}

export function cycleStatusFromDays(days: number): CycleStatus {
  if (days < 0) return 'overdue'
  if (days <= 30) return 'urgent-30'
  if (days <= 90) return 'warning-90'
  return 'on-track'
}

const MS_DAY = 86_400_000
function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * MS_DAY)
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Auto-generate a year of GF reporting cycles relative to `today`. The caller
// supplies today (the app avoids non-deterministic Date in shared modules where
// possible, but the compliance calendar is inherently relative to now).
export function generateComplianceCycles(today: Date): ComplianceCycleItem[] {
  const items: { type: GfCycleType; title: string; offset: number }[] = [
    { type: 'PC', title: 'Progress Concept - Grant Year 2', offset: -120 },
    { type: 'PU', title: 'Progress Update - Q1', offset: -10 },
    { type: 'FCR', title: 'Financial Compliance Report - Q1', offset: 18 },
    { type: 'PU', title: 'Progress Update - Q2', offset: 75 },
    { type: 'PUDR', title: 'Progress Update & Disbursement Request - S1', offset: 88 },
    { type: 'FCR', title: 'Financial Compliance Report - Q2', offset: 110 },
    { type: 'PU', title: 'Progress Update - Q3', offset: 168 },
    { type: 'PUDR', title: 'Progress Update & Disbursement Request - S2', offset: 200 },
    { type: 'Final PU', title: 'Final Progress Update - Grant Closure', offset: 320 },
  ]
  return items.map((it, i) => {
    const due = addDays(today, it.offset)
    return {
      id: `gf-cycle-${i + 1}`,
      type: it.type,
      title: it.title,
      dueDate: isoDate(due),
      status: cycleStatusFromDays(it.offset),
    }
  })
}

// ----------------------------------------------------------------------------
// Trust Delta & Negotiated Consensus
// ----------------------------------------------------------------------------

export interface TrustDeltaRow {
  qId: string
  domain: string
  question: string
  /** The PR / organization self-score. */
  prScore: number
  /** The independent assessor / LFA score. */
  assessorScore: number
  /** The negotiated, validated score (set during the Facilitated Debrief). */
  negotiatedScore?: number
  /** Whether operational/implementation evidence is weak (triggers the penalty). */
  evidenceWeak?: boolean
  scale?: ScaleType
}

// Variance and "Optimism Bias %" - how much higher the PR scored itself vs the
// independent assessor, as a share of the scale maximum.
export function variance(row: { prScore: number; assessorScore: number }): number {
  return row.prScore - row.assessorScore
}
export function optimismBias(row: { prScore: number; assessorScore: number; scale?: ScaleType }): number {
  const max = scaleMax(row.scale ?? 'fiduciary-0-5')
  if (max === 0) return 0
  return Math.round(((row.prScore - row.assessorScore) / max) * 1000) / 10
}

export interface PaperCompliancePenalty {
  triggered: boolean
  cappedScore?: number
  message?: string
}

// Pact "paper compliance" rule: if the negotiated score claims more than Basic
// (>2) but operational evidence is insufficient, the final score is capped at
// Level 2 (Basic) and an amber banner is shown.
export function paperCompliancePenalty(negotiatedScore: number, evidenceWeak: boolean): PaperCompliancePenalty {
  if (negotiatedScore > 2 && evidenceWeak) {
    return {
      triggered: true,
      cappedScore: 2,
      message:
        '⚠️ PAPER COMPLIANCE PENALTY: Policy exists but operational evidence is insufficient. Final score capped at Level 2 (Basic).',
    }
  }
  return { triggered: false }
}

// Illustrative trust-delta dataset used by the Verify / Trust Delta surfaces.
export const TRUST_DELTA_SEED: TrustDeltaRow[] = [
  { qId: 'OMT-FIN-01', domain: 'Financial Management', question: 'Financial systems produce timely, accurate information', prScore: 4, assessorScore: 2, evidenceWeak: true, scale: 'omt-1-4' },
  { qId: 'OMT-GOV-01', domain: 'Governance', question: 'Governing body provides effective oversight', prScore: 4, assessorScore: 3, scale: 'omt-1-4' },
  { qId: 'OMT-HR-01', domain: 'Human Resources', question: 'Job descriptions documented and roles delineated', prScore: 3, assessorScore: 3, scale: 'omt-1-4' },
  { qId: 'OMT-TECH-01', domain: 'Technology', question: 'Technology and information systems meet needs', prScore: 3, assessorScore: 1, evidenceWeak: true, scale: 'omt-1-4' },
  { qId: 'OMT-ADMIN-01', domain: 'Administration', question: 'Administrative policies support efficient operations', prScore: 2, assessorScore: 2, scale: 'omt-1-4' },
  { qId: 'OMT-MEL-01', domain: 'MEL', question: 'Organization measures results and uses evidence', prScore: 4, assessorScore: 2, evidenceWeak: true, scale: 'omt-1-4' },
]

export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString('en-US')}`
}
