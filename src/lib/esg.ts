// ============================================================================
// ESG Self-Assessment
// ----------------------------------------------------------------------------
// A standalone ESG (Environmental, Social, Governance) diagnostic modeled on
// GRI / IFRS S1-S2 / TCFD disclosure categories, with a scoring methodology
// benchmarked against how independent ESG self-assessment platforms actually
// operate (response + reviewer-verified evidence, blended - not a single
// self-reported number). It reuses the platform's existing fiduciary 0-5
// scale (see frameworks.ts) so colors and badges stay visually consistent
// with every other framework.
//
// Every question carries:
//   - pillar        - which of the three ESG pillars it belongs to
//   - frameworkRefs - the GRI Standard / IFRS Sustainability Standard / TCFD
//                      pillar this question maps to, for traceability
//   - recommendation - the concrete next action to close the gap, shown
//                       whenever the question scores below "Defined" (3)
//   - financingNote  - why this specific item matters to a financier,
//                       investor, partner, procurement officer or to
//                       sustainability-reporting readiness
// so gaps, recommendations and the financing narrative all fall out of the
// same question data - no separate content model.
//
// Scoring is two-layer, same idea as a reviewer-controlled ESG platform:
//   - "Response" score  - the self-reported 0-5 answer (self-assessment).
//   - "Evidence" score   - a 0-4 verification level per supporting document
//                           (Missing / Weak / Partial / Strong / Verified),
//                           scaled to 0-5.
//   - "Verified" score   - 60% response + 40% evidence, per pillar and
//                           composite. The rating badge is computed from
//                           this blended score, and is explicitly marked
//                           "Provisional" until evidence coverage is high
//                           enough to trust it - a self-assessment alone is
//                           never presented as a final/independent rating.
// ============================================================================

import type { RubricQuestion } from './frameworks'

export type EsgPillar = 'Environmental' | 'Social' | 'Governance'

export const ESG_PILLARS: { key: EsgPillar; blurb: string }[] = [
  { key: 'Environmental', blurb: 'Climate, resource use and environmental compliance' },
  { key: 'Social', blurb: 'Labor practices, safety, DEI and community impact' },
  { key: 'Governance', blurb: 'Board oversight, ethics, risk controls and disclosure' },
]

export interface EsgQuestion extends RubricQuestion {
  pillar: EsgPillar
  /** GRI Standard / IFRS Sustainability Standard / TCFD pillar this question maps to. */
  frameworkRefs: string[]
  recommendation: string
  financingNote: string
}

export const ESG_QUESTIONS: EsgQuestion[] = [
  // --- Environmental ---------------------------------------------------
  {
    id: 'ESG-E1',
    pillar: 'Environmental',
    domain: 'Climate & Emissions',
    frameworkRefs: ['GRI 305', 'TCFD', 'IFRS S2'],
    question: 'Does the organization measure and manage its greenhouse gas emissions?',
    soe: {
      0: 'Emissions are not tracked in any form.',
      1: 'Emissions are estimated informally with no consistent method.',
      2: 'A basic Scope 1/2 estimate exists but is not updated regularly.',
      3: 'Scope 1 and 2 emissions are measured annually using a documented method.',
      4: 'Scope 1, 2 and material Scope 3 emissions are tracked, reviewed and trending down.',
      5: 'Emissions are independently verified and tied to a published reduction target.',
    },
    evidence: 'GHG inventory, utility/fuel records, emissions reduction plan.',
    recommendation: 'Stand up an annual Scope 1/2 emissions inventory using a recognized method (e.g. GHG Protocol) before attempting Scope 3.',
    financingNote: 'Climate finance and most DFI facilities now require at minimum a Scope 1/2 baseline before disbursement.',
  },
  {
    id: 'ESG-E2',
    pillar: 'Environmental',
    domain: 'Resource & Waste Efficiency',
    frameworkRefs: ['GRI 302', 'GRI 306'],
    question: 'Are resource use (energy, water, materials) and waste streams actively managed?',
    soe: {
      0: 'No tracking of resource consumption or waste.',
      1: 'Awareness of usage but no data collected.',
      2: 'Utility bills are kept but not analyzed for efficiency.',
      3: 'Consumption is tracked and benchmarked year over year.',
      4: 'Active efficiency program with documented reduction in waste/energy intensity.',
      5: 'Circular-economy practices in place (reuse, recycling, take-back) with measured diversion rate.',
    },
    evidence: 'Utility bills, waste manifests, efficiency program documentation.',
    recommendation: 'Start logging monthly energy, water and waste volumes - the data itself usually surfaces the first efficiency win.',
    financingNote: 'Procurement RFPs increasingly score bidders on resource efficiency as a tie-breaker.',
  },
  {
    id: 'ESG-E3',
    pillar: 'Environmental',
    domain: 'Environmental Compliance',
    frameworkRefs: ['GRI 2-27'],
    question: 'Does the organization hold and maintain all required environmental permits and clearances?',
    soe: {
      0: 'Required permits are unknown or absent.',
      1: 'Some permits held but several are lapsed or missing.',
      2: 'Core permits held; renewal tracking is informal.',
      3: 'All required permits held and tracked with renewal dates.',
      4: 'Permits held plus an internal environmental compliance calendar.',
      5: 'Zero compliance findings in the last 3 years, independently audited.',
    },
    evidence: 'Environmental permits/licences, EIA certificates, regulator correspondence.',
    recommendation: 'Build a permit register with renewal dates and assign an owner - most lapses are calendar failures, not legal ones.',
    financingNote: 'A lapsed environmental permit is a common deal-breaker in DFI/PE environmental due diligence.',
  },
  {
    id: 'ESG-E4',
    pillar: 'Environmental',
    domain: 'Climate Risk Exposure',
    frameworkRefs: ['TCFD', 'IFRS S2'],
    question: 'Has the organization assessed its physical and transition climate risk exposure?',
    soe: {
      0: 'Climate risk has never been considered.',
      1: 'Informal awareness that climate risk may be relevant.',
      2: 'A qualitative risk list exists but is not scored.',
      3: 'Physical and transition risks are identified and scored.',
      4: 'Risks are scenario-tested and feed into strategic planning.',
      5: 'Climate risk is integrated into enterprise risk management with board-level reporting.',
    },
    evidence: 'Climate risk register, scenario analysis, ERM integration records.',
    recommendation: 'Run a lightweight physical + transition risk screen against your top 3 sites/operations before building a full scenario model.',
    financingNote: 'Aligns directly with ISSB/TCFD disclosure expectations now written into many lending covenants.',
  },

  // --- Social ------------------------------------------------------------
  {
    id: 'ESG-S1',
    pillar: 'Social',
    domain: 'Labor Practices & Human Capital',
    frameworkRefs: ['GRI 401', 'GRI 407'],
    question: 'Are fair labor practices documented and consistently applied?',
    soe: {
      0: 'No documented labor policies.',
      1: 'Informal practices, inconsistently applied.',
      2: 'Basic policy exists but is not communicated to staff.',
      3: 'Documented labor policy, communicated and consistently applied.',
      4: 'Policy includes living-wage benchmarking and grievance mechanism.',
      5: 'Independently audited labor practices with published outcomes.',
    },
    evidence: 'HR policy manual, employment contracts, wage benchmarking study.',
    recommendation: 'Publish a single labor policy document covering wages, hours and grievance handling, and have every employee acknowledge it.',
    financingNote: 'Labor-practice red flags are one of the most common reasons impact investors walk away post-diligence.',
  },
  {
    id: 'ESG-S2',
    pillar: 'Social',
    domain: 'Health & Safety',
    frameworkRefs: ['GRI 403'],
    question: 'Is there an active occupational health and safety (OHS) management system?',
    soe: {
      0: 'No OHS system; incidents are not tracked.',
      1: 'Ad-hoc safety awareness, no formal system.',
      2: 'Basic safety rules exist but incident tracking is inconsistent.',
      3: 'OHS system in place with incident tracking and reporting.',
      4: 'OHS system with regular training and a declining incident trend.',
      5: 'Certified OHS management system (e.g. ISO 45001) with zero lost-time incidents.',
    },
    evidence: 'OHS policy, incident log, training records, certifications.',
    recommendation: 'Start a simple incident log today - you cannot improve a safety record you are not measuring.',
    financingNote: 'Lenders to physical operations (manufacturing, agriculture, construction) typically require evidence of an active OHS system as a condition precedent.',
  },
  {
    id: 'ESG-S3',
    pillar: 'Social',
    domain: 'Diversity, Equity & Inclusion',
    frameworkRefs: ['GRI 405'],
    question: 'Does the organization track and actively manage workforce diversity?',
    soe: {
      0: 'No diversity data collected.',
      1: 'Awareness of the issue, no data.',
      2: 'Headcount diversity known informally but not reported.',
      3: 'Diversity data tracked and reported internally (gender, at minimum).',
      4: 'Diversity targets set with a documented action plan.',
      5: 'Diversity targets met and disclosed externally, including leadership representation.',
    },
    evidence: 'Workforce composition data, DEI policy, leadership representation report.',
    recommendation: 'Start with one metric - gender split by seniority level - before building a broader DEI program.',
    financingNote: 'Gender-lens and 2X-aligned investors specifically screen for workforce and leadership diversity data.',
  },
  {
    id: 'ESG-S4',
    pillar: 'Social',
    domain: 'Community & Stakeholder Engagement',
    frameworkRefs: ['GRI 413'],
    question: 'Is there a structured process for engaging and addressing concerns from affected communities?',
    soe: {
      0: 'No community engagement process.',
      1: 'Engagement happens reactively, only when issues arise.',
      2: 'Informal engagement exists but nothing is documented.',
      3: 'A documented stakeholder engagement plan is in place.',
      4: 'Plan includes a functioning grievance redress mechanism with tracked resolution times.',
      5: 'Engagement outcomes are independently monitored and published.',
    },
    evidence: 'Stakeholder engagement plan, grievance log, community consultation records.',
    recommendation: 'Set up a single, visible channel (phone line, box, or form) for community grievances and commit to a resolution timeline.',
    financingNote: 'IFC Performance Standards and most DFI social safeguards require a functioning grievance mechanism as a baseline condition.',
  },

  // --- Governance ----------------------------------------------------------
  {
    id: 'ESG-G1',
    pillar: 'Governance',
    domain: 'Board Oversight & Structure',
    frameworkRefs: ['GRI 2-9', 'GRI 2-12'],
    question: 'Does the governing board provide active, independent oversight of strategy and risk?',
    soe: {
      0: 'No functioning board or governing body.',
      1: 'Board exists on paper; rarely meets or decides anything.',
      2: 'Board meets but lacks independent members or formal agendas.',
      3: 'Board meets regularly with minutes, agendas and some independent members.',
      4: 'Board has defined committees (audit/risk) and documented oversight of management.',
      5: 'Board effectiveness is independently reviewed and disclosed.',
    },
    evidence: 'Board charter, meeting minutes, committee terms of reference.',
    recommendation: 'Formalize a board calendar with a standing risk/finance agenda item, and minute every meeting.',
    financingNote: 'Weak board oversight is the single most common governance red flag in institutional due diligence.',
  },
  {
    id: 'ESG-G2',
    pillar: 'Governance',
    domain: 'Business Ethics & Anti-Corruption',
    frameworkRefs: ['GRI 205'],
    question: 'Is there a documented anti-corruption / code of conduct policy, actively enforced?',
    soe: {
      0: 'No code of conduct or anti-corruption policy.',
      1: 'Informal expectation of honesty, nothing written.',
      2: 'Code of conduct exists but is not communicated or enforced.',
      3: 'Code of conduct communicated to all staff, with sign-off.',
      4: 'Policy includes a whistleblower channel and periodic ethics training.',
      5: 'Independently audited anti-corruption program with zero substantiated findings.',
    },
    evidence: 'Code of conduct, anti-bribery policy, whistleblower log, training records.',
    recommendation: 'Adopt a one-page code of conduct covering gifts, conflicts of interest and reporting, and have staff sign it annually.',
    financingNote: 'Anti-corruption policy is a near-universal condition precedent for DFI and multilateral financing.',
  },
  {
    id: 'ESG-G3',
    pillar: 'Governance',
    domain: 'Risk Management & Internal Controls',
    frameworkRefs: ['TCFD'],
    question: 'Are financial and operational risks formally identified, scored and monitored?',
    soe: {
      0: 'No risk management process.',
      1: 'Risks are discussed informally when problems occur.',
      2: 'A risk list exists but is not scored or owned.',
      3: 'A risk register exists with owners and is reviewed periodically.',
      4: 'Risk register is scored, tracked and reported to the board.',
      5: 'Enterprise risk management is independently assured and integrated into strategic planning.',
    },
    evidence: 'Risk register, internal controls policy, internal/external audit reports.',
    recommendation: 'Build a one-page risk register (top 10 risks, owner, likelihood/impact) and review it quarterly.',
    financingNote: 'A live risk register is typically the first document requested in institutional financial due diligence.',
  },
  {
    id: 'ESG-G4',
    pillar: 'Governance',
    domain: 'Transparency & Disclosure',
    frameworkRefs: ['GRI 2-3', 'IFRS S1'],
    question: 'Does the organization publish regular, reliable performance and governance disclosures?',
    soe: {
      0: 'No external reporting of any kind.',
      1: 'Reporting only when required by a specific funder.',
      2: 'Annual report produced but inconsistent or late.',
      3: 'Annual financial and narrative report produced on schedule.',
      4: 'Report includes ESG/sustainability performance alongside financials.',
      5: 'Disclosures are independently audited and published proactively.',
    },
    evidence: 'Annual report, audited financial statements, ESG/sustainability disclosure.',
    recommendation: 'Add a one-page ESG summary to your existing annual report before building a standalone sustainability report.',
    financingNote: 'Consistent, timely disclosure is what ESG-linked loans and sustainability-linked bonds price against.',
  },
]

export function questionsForPillar(pillar: EsgPillar): EsgQuestion[] {
  return ESG_QUESTIONS.filter(q => q.pillar === pillar)
}

// ----------------------------------------------------------------------------
// Evidence verification (reviewer-scored, mirrors the 5-point verification
// scale used by independent ESG review platforms: Missing/Weak/Partial/
// Strong/Verified, rather than a flat "uploaded or not" checkbox).
// ----------------------------------------------------------------------------

export interface EvidenceLevel {
  value: number // 0-4
  label: string
  badge: string
}

export const EVIDENCE_LEVELS: EvidenceLevel[] = [
  { value: 0, label: 'Missing', badge: 'bg-rose-100 text-rose-700 border-rose-300' },
  { value: 1, label: 'Weak', badge: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 2, label: 'Partial', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 3, label: 'Strong', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 4, label: 'Verified', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
]

export const ESG_DOCS: Record<EsgPillar, string[]> = {
  Environmental: [
    'GHG emissions inventory',
    'Environmental permits & licences',
    'Environmental/Social Impact Assessment (ESIA)',
    'Climate risk assessment',
  ],
  Social: [
    'HR / labor policy manual',
    'Occupational health & safety policy',
    'Workforce diversity data',
    'Stakeholder engagement & grievance plan',
  ],
  Governance: [
    'Board charter & committee terms of reference',
    'Code of conduct / anti-corruption policy',
    'Risk register',
    'Latest audited financial statements',
  ],
}

export function docKey(pillar: string, doc: string): string {
  return `${pillar}::${doc}`
}

/** Mean evidence level (0-4) across a pillar's documents, scaled to 0-5 to match the response scale. 0 if nothing scored. */
export function pillarEvidenceScore(pillar: EsgPillar, evidence: Record<string, number>): number {
  const docs = ESG_DOCS[pillar]
  const scored = docs.filter(d => evidence[docKey(pillar, d)] != null)
  if (scored.length === 0) return 0
  const sum = scored.reduce((acc, d) => acc + (evidence[docKey(pillar, d)] ?? 0), 0)
  return Math.round(((sum / scored.length) * (5 / 4)) * 100) / 100
}

/** Share (0-100) of all documents scored "Strong" or "Verified". Drives the Confidence stat. */
export function evidenceCoveragePct(evidence: Record<string, number>): number {
  const allDocs = ESG_PILLARS.flatMap(p => ESG_DOCS[p.key].map(d => docKey(p.key, d)))
  if (allDocs.length === 0) return 0
  const strong = allDocs.filter(k => (evidence[k] ?? -1) >= 3).length
  return Math.round((strong / allDocs.length) * 100)
}

export type ConfidenceLevel = 'Low' | 'Medium' | 'High'

export function confidenceFromCoverage(coveragePct: number): ConfidenceLevel {
  if (coveragePct >= 70) return 'High'
  if (coveragePct >= 35) return 'Medium'
  return 'Low'
}

// ----------------------------------------------------------------------------
// Scoring
// ----------------------------------------------------------------------------

const GAP_THRESHOLD = 3 // below "Defined" counts as a gap
const STRENGTH_THRESHOLD = 4 // "Managed" or above counts as a strength
const RESPONSE_WEIGHT = 0.6
const EVIDENCE_WEIGHT = 0.4

/** Self-reported response score for a pillar (0-5), ignoring evidence. */
export function pillarScore(pillar: EsgPillar, scores: Record<string, number>): number {
  const qs = questionsForPillar(pillar)
  const answered = qs.filter(q => scores[q.id] != null)
  if (answered.length === 0) return 0
  const sum = answered.reduce((acc, q) => acc + (scores[q.id] ?? 0), 0)
  return Math.round((sum / answered.length) * 100) / 100
}

/** Blended 60% response + 40% evidence score for a pillar (0-5). */
export function pillarVerifiedScore(
  pillar: EsgPillar,
  scores: Record<string, number>,
  evidence: Record<string, number>,
): number {
  const response = pillarScore(pillar, scores)
  const ev = pillarEvidenceScore(pillar, evidence)
  return Math.round((response * RESPONSE_WEIGHT + ev * EVIDENCE_WEIGHT) * 100) / 100
}

function answeredPillars(scores: Record<string, number>) {
  return ESG_PILLARS.filter(p => questionsForPillar(p.key).some(q => scores[q.id] != null))
}

/** Composite self-reported response score (0-5) - what IPMC-style tools label "Response". */
export function compositeEsgScore(scores: Record<string, number>): number {
  const answered = answeredPillars(scores)
  if (answered.length === 0) return 0
  const sum = answered.reduce((acc, p) => acc + pillarScore(p.key, scores), 0)
  return Math.round((sum / answered.length) * 100) / 100
}

/** Composite blended response+evidence score (0-5) - the basis for the rating badge. */
export function compositeVerifiedScore(scores: Record<string, number>, evidence: Record<string, number>): number {
  const answered = answeredPillars(scores)
  if (answered.length === 0) return 0
  const sum = answered.reduce((acc, p) => acc + pillarVerifiedScore(p.key, scores, evidence), 0)
  return Math.round((sum / answered.length) * 100) / 100
}

export interface EsgGap {
  question: EsgQuestion
  score: number
}

/** Answered questions scoring below the "Defined" threshold, worst first. */
export function identifyGaps(scores: Record<string, number>): EsgGap[] {
  return ESG_QUESTIONS
    .filter(q => scores[q.id] != null && (scores[q.id] as number) < GAP_THRESHOLD)
    .map(q => ({ question: q, score: scores[q.id] as number }))
    .sort((a, b) => a.score - b.score)
}

/** Answered questions at "Managed" (4) or above, best first - the mirror of identifyGaps. */
export function identifyStrengths(scores: Record<string, number>): EsgGap[] {
  return ESG_QUESTIONS
    .filter(q => scores[q.id] != null && (scores[q.id] as number) >= STRENGTH_THRESHOLD)
    .map(q => ({ question: q, score: scores[q.id] as number }))
    .sort((a, b) => b.score - a.score)
}

/** Unanswered questions - these count against the badge but aren't "gaps" yet. */
export function unansweredQuestions(scores: Record<string, number>): EsgQuestion[] {
  return ESG_QUESTIONS.filter(q => scores[q.id] == null)
}

// ----------------------------------------------------------------------------
// ESG rating badge - mirrors mainstream letter-band ESG ratings (e.g. MSCI
// AAA-CCC) so the output is immediately legible to financiers and partners.
// Computed from the blended (response + evidence) score, not the raw
// self-report, and explicitly flagged "Provisional" until evidence coverage
// is high enough to trust - a self-assessment alone is never presented as a
// final or independent rating.
// ----------------------------------------------------------------------------

export interface EsgBadge {
  letter: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'Unrated'
  label: string
  cls: string
  provisional: boolean
}

const PROVISIONAL_COVERAGE_THRESHOLD = 70 // % of docs at "Strong"+ needed to lift the provisional flag

export function getEsgBadge(
  verifiedScore: number,
  totalAnswered: number,
  evidenceCoverage: number,
): EsgBadge {
  if (totalAnswered < ESG_QUESTIONS.length) {
    return { letter: 'Unrated', label: 'Unrated - assessment incomplete', cls: 'bg-slate-100 text-slate-600 border-slate-300', provisional: true }
  }
  const provisional = evidenceCoverage < PROVISIONAL_COVERAGE_THRESHOLD
  if (verifiedScore >= 4.5) return { letter: 'AAA', label: 'Leader', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', provisional }
  if (verifiedScore >= 4.0) return { letter: 'AA', label: 'Leader', cls: 'bg-emerald-100 text-emerald-700 border-emerald-300', provisional }
  if (verifiedScore >= 3.5) return { letter: 'A', label: 'Strong Performer', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', provisional }
  if (verifiedScore >= 3.0) return { letter: 'BBB', label: 'Average Performer', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', provisional }
  if (verifiedScore >= 2.0) return { letter: 'BB', label: 'Below Average', cls: 'bg-amber-100 text-amber-700 border-amber-300', provisional }
  if (verifiedScore >= 1.0) return { letter: 'B', label: 'Laggard', cls: 'bg-rose-100 text-rose-700 border-rose-300', provisional }
  return { letter: 'CCC', label: 'High Risk', cls: 'bg-rose-100 text-rose-800 border-rose-400', provisional }
}

// ----------------------------------------------------------------------------
// Financing / investment / partnership / procurement / reporting positioning
// ----------------------------------------------------------------------------

export function financingPositioning(badge: EsgBadge, gaps: EsgGap[]): string {
  if (badge.letter === 'Unrated') {
    return 'Complete every question to unlock a rating. An incomplete ESG profile is typically treated as a "no" by ESG-linked financing screens, regardless of actual performance.'
  }
  const provisionalNote = badge.provisional
    ? ' This rating is provisional pending stronger supporting evidence - add or upgrade documents below to move it to a confirmed result.'
    : ''
  if (badge.letter === 'AAA' || badge.letter === 'AA') {
    return `This profile is strong enough to lead with ESG as a differentiator in financing, partnership, procurement and sustainability-reporting conversations - consider pursuing a sustainability-linked facility or publishing results to attract impact-focused capital.${provisionalNote}`
  }
  if (badge.letter === 'A' || badge.letter === 'BBB') {
    return `Fundable with standard ESG conditions attached, and a workable starting point for GRI/IFRS S1-S2/TCFD-aligned reporting. Closing the ${gaps.length} open gap(s) below would move this profile into the top rating band and remove the most common conditions financiers attach at this level.${provisionalNote}`
  }
  return `At this rating, most ESG-linked financing, DFI facilities and large-procurement tenders will treat ESG gaps as a blocking condition, not a minor note. Prioritize the ${Math.min(3, gaps.length)} lowest-scoring item(s) below before approaching financing, tender processes or sustainability disclosure.${provisionalNote}`
}
