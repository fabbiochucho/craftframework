// ============================================================================
// CRAFT Capital Readiness Ladder
// ----------------------------------------------------------------------------
// A 7-rung sequential diagnostic answering: "is this institution sufficiently
// strong, credible, resilient and investable to attract and sustain capital?"
// Unlike the platform's other scorecards (which average scores across flat
// domains), a ladder is sequential by design - an institution cannot
// meaningfully claim "Investability" readiness if it has not first cleared
// "Credibility" and "Resilience". So the headline output here is not just a
// mean score but the organization's current rung: the highest level fully
// achieved, with every level below it also achieved.
//
// Reuses the platform's fiduciary 0-5 scale and RubricQuestion shape (see
// frameworks.ts) for visual and structural consistency with every other
// framework. Links forward to the ESG Self-Assessment's rating-agency
// translation at Level 7, rather than duplicating that content.
// ============================================================================

import type { RubricQuestion } from './frameworks'

export interface LadderLevel {
  level: number
  key: string
  name: string
  question: string
}

export const LADDER_LEVELS: LadderLevel[] = [
  { level: 1, key: 'survival', name: 'Survival', question: 'Does the institution exist, legally and operationally, on a sound footing?' },
  { level: 2, key: 'credibility', name: 'Credibility', question: 'Can external stakeholders trust what this institution reports?' },
  { level: 3, key: 'resilience', name: 'Resilience', question: 'Can the institution survive a financial, operational or leadership shock?' },
  { level: 4, key: 'sustainability', name: 'Sustainability', question: 'Does the institution create durable environmental and social value?' },
  { level: 5, key: 'investability', name: 'Investability', question: 'Can external capital confidently and safely enter?' },
  { level: 6, key: 'scale', name: 'Scale & Institutionalization', question: 'Can the institution absorb significantly more capital without destroying value?' },
  { level: 7, key: 'capital-markets', name: 'Capital Market Readiness', question: 'Is the institution ready for DFI, PE, bond or public-market capital?' },
]

export interface LadderIndicator extends RubricQuestion {
  level: number
  recommendation: string
  ladderRelevance: string
}

export const LADDER_INDICATORS: LadderIndicator[] = [
  // --- Level 1: Survival ---------------------------------------------------
  {
    id: 'CRL-1A', level: 1, domain: 'Legal Structure & Registration',
    question: 'Is the institution properly registered and legally constituted for its activities?',
    soe: {
      0: 'No legal registration exists.', 1: 'Registration is incomplete or lapsed.',
      2: 'Basic registration held but governing documents are outdated.',
      3: 'Properly registered with current governing documents on file.',
      4: 'Registration and governing documents reviewed and updated on a defined cycle.',
      5: 'Legal structure independently reviewed for fitness against current and planned activities.',
    },
    evidence: 'Certificate of incorporation/registration, constitution/bylaws, board resolutions.',
    recommendation: 'Confirm registration is current and governing documents match what the institution actually does today.',
    ladderRelevance: 'Without a sound legal footing, every later rung - credibility, resilience, investability - is built on sand.',
  },
  {
    id: 'CRL-1B', level: 1, domain: 'Basic Financial Controls',
    question: 'Are basic financial controls (segregation of duties, approvals, bank reconciliation) in place?',
    soe: {
      0: 'No financial controls exist.', 1: 'One person controls all financial decisions and records.',
      2: 'Some separation of duties but inconsistently applied.',
      3: 'Documented approval thresholds and segregation of duties in place.',
      4: 'Controls are monitored and bank reconciliations performed monthly.',
      5: 'Controls independently tested with no material weaknesses found.',
    },
    evidence: 'Finance policy, approval matrix, bank reconciliation records.',
    recommendation: 'Put a two-signature rule on payments above a defined threshold - the single highest-leverage control for an institution at this stage.',
    ladderRelevance: 'This is the single most common failure point that keeps institutions permanently stuck below "Credibility".',
  },
  {
    id: 'CRL-1C', level: 1, domain: 'Core Governance & Leadership',
    question: 'Is there a functioning leadership structure with defined decision rights?',
    soe: {
      0: 'No defined leadership or decision-making structure.', 1: 'Leadership exists informally, roles undefined.',
      2: 'Roles are defined but decision rights are unclear or contested.',
      3: 'Leadership structure and decision rights are documented.',
      4: 'Leadership structure includes at least one layer of oversight beyond the chief executive.',
      5: 'Leadership effectiveness is periodically reviewed against institutional goals.',
    },
    evidence: 'Organogram, delegation of authority matrix, leadership job descriptions.',
    recommendation: 'Write down who can approve what, even in a one-page delegation matrix - ambiguity here blocks every later rung.',
    ladderRelevance: 'Defined decision rights are the precondition for the independent oversight Level 2 and Level 5 both require.',
  },

  // --- Level 2: Credibility --------------------------------------------------
  {
    id: 'CRL-2A', level: 2, domain: 'Auditable Financial Records',
    question: 'Are financial records maintained to a standard that would withstand an external audit?',
    soe: {
      0: 'No financial records maintained.', 1: 'Records exist but are incomplete or inconsistent.',
      2: 'Records are complete but not reconciled to a defined accounting standard.',
      3: 'Records maintained to a recognized accounting standard, reconciled monthly.',
      4: 'Records have passed an external review or audit with no material findings.',
      5: 'Multi-year audit history with unqualified opinions.',
    },
    evidence: 'Management accounts, audit reports, accounting policy documentation.',
    recommendation: 'Commission a light external review even before a full audit - it surfaces the gaps a real audit would flag, at lower cost.',
    ladderRelevance: 'Auditable records are the foundation every later claim about resilience, sustainability or investability is checked against.',
  },
  {
    id: 'CRL-2B', level: 2, domain: 'Transparent Governance & Reporting',
    question: 'Does the institution report regularly and transparently to its stakeholders?',
    soe: {
      0: 'No external reporting.', 1: 'Reporting only when a specific funder demands it.',
      2: 'Annual report produced but inconsistent or late.',
      3: 'Annual report produced on schedule with governance and financial content.',
      4: 'Reporting includes forward-looking plans, not just historical results.',
      5: 'Reporting is independently assured and proactively published.',
    },
    evidence: 'Annual reports, board meeting minutes, stakeholder communications.',
    recommendation: 'Commit to one annual report with a fixed publication date - consistency matters more than length at this stage.',
    ladderRelevance: 'Predictable, transparent reporting is what lets an outside party trust the institution without having to verify everything themselves.',
  },
  {
    id: 'CRL-2C', level: 2, domain: 'Evidence of Delivery',
    question: 'Can the institution demonstrate a track record of delivering on its stated mandate?',
    soe: {
      0: 'No evidence of delivery exists.', 1: 'Delivery claimed but undocumented.',
      2: 'Some delivery evidence exists but is not systematically collected.',
      3: 'A documented track record of delivery exists and is referenced in reporting.',
      4: 'Delivery is measured against defined targets with results tracked over time.',
      5: 'Delivery results are independently verified or evaluated.',
    },
    evidence: 'Project/program reports, outcome data, third-party evaluations or references.',
    recommendation: 'Pick the three most recent results you can prove with a document, and build the track-record case from there.',
    ladderRelevance: 'A funder or investor rarely takes a mission statement on faith - they look for proof the institution does what it says.',
  },

  // --- Level 3: Resilience ----------------------------------------------------
  {
    id: 'CRL-3A', level: 3, domain: 'Financial Resilience & Reserves',
    question: 'Does the institution hold sufficient reserves or access to liquidity to absorb a financial shock?',
    soe: {
      0: 'No reserves and no contingency access to liquidity.', 1: 'Minimal reserves, less than one month of operating costs.',
      2: 'Reserves cover one to two months of operating costs.',
      3: 'Reserves cover three or more months of operating costs.',
      4: 'A documented reserves policy exists and is actively maintained.',
      5: 'Reserves plus a tested contingency credit line cover six or more months.',
    },
    evidence: 'Reserves policy, cash-flow forecast, bank facility documentation.',
    recommendation: 'Set a minimum reserve target (e.g. 3 months of core costs) and track it as a board-level metric.',
    ladderRelevance: 'Financial resilience is what prevents a single bad quarter from undoing every rung climbed so far.',
  },
  {
    id: 'CRL-3B', level: 3, domain: 'Operational & Crisis Continuity',
    question: 'Is there a documented plan for maintaining operations through a disruption?',
    soe: {
      0: 'No continuity planning exists.', 1: 'Informal awareness that disruption is possible.',
      2: 'A basic continuity list exists but is untested.',
      3: 'A documented business continuity plan exists.',
      4: 'The plan has been tested through a drill or real incident.',
      5: 'Continuity planning is reviewed and updated on a defined cycle, informed by past incidents.',
    },
    evidence: 'Business continuity plan, incident log, after-action reviews.',
    recommendation: 'Write down the three most likely disruptions to your operations and a one-paragraph response for each - that is a real starting plan.',
    ladderRelevance: 'DFIs and insurers specifically screen for continuity planning before extending facilities to physical operations.',
  },
  {
    id: 'CRL-3C', level: 3, domain: 'Leadership Succession Planning',
    question: 'Would the institution survive the sudden departure of its chief executive or founder?',
    soe: {
      0: 'No succession plan; the institution is entirely dependent on one person.', 1: 'Informal awareness of the risk, no plan.',
      2: 'An interim-coverage plan exists but is undocumented.',
      3: 'A documented succession plan exists for the top leadership role.',
      4: 'Succession planning extends to the senior leadership team, not just the chief executive.',
      5: 'Succession readiness is tested (e.g. an interim handover has occurred without disruption).',
    },
    evidence: 'Succession plan, delegation of authority matrix, board minutes discussing succession.',
    recommendation: 'Name a documented second-in-command with real delegated authority - even an informal succession plan beats none.',
    ladderRelevance: 'Key-person risk is one of the most common reasons institutional investors decline otherwise-strong opportunities.',
  },

  // --- Level 4: Sustainability --------------------------------------------
  {
    id: 'CRL-4A', level: 4, domain: 'Environmental & Resource Performance',
    question: 'Does the institution actively manage its environmental footprint?',
    soe: {
      0: 'Environmental performance is not considered.', 1: 'Informal awareness, no data.',
      2: 'Basic resource use is tracked but not managed.',
      3: 'Resource use and waste are tracked and benchmarked.',
      4: 'An active efficiency or emissions-reduction program is in place.',
      5: 'Environmental performance is independently verified and reported.',
    },
    evidence: 'Utility/resource data, GHG inventory, environmental policy.',
    recommendation: 'Use the CRAFT ESG Self-Assessment\'s Environmental pillar directly - the same evidence satisfies both.',
    ladderRelevance: 'Environmental and social performance is what separates a merely resilient institution from one that creates durable value.',
  },
  {
    id: 'CRL-4B', level: 4, domain: 'Social Value & Human Capital',
    question: 'Does the institution invest in and protect the people who work for and with it?',
    soe: {
      0: 'No consideration of workforce or social value.', 1: 'Informal, undocumented labor practices.',
      2: 'Basic labor policy exists but is not consistently applied.',
      3: 'Documented labor and safety policies, consistently applied.',
      4: 'Workforce development and wellbeing programs are in place.',
      5: 'Social value and human-capital outcomes are measured and reported.',
    },
    evidence: 'HR and OHS policies, training records, workforce survey results.',
    recommendation: 'Use the CRAFT ESG Self-Assessment\'s Social pillar directly - the same evidence satisfies both.',
    ladderRelevance: 'Institutions that treat their people as an afterthought rarely sustain the delivery track record Level 2 established.',
  },
  {
    id: 'CRL-4C', level: 4, domain: 'Community Legitimacy',
    question: 'Is the institution seen as legitimate and trusted by the communities it affects or serves?',
    soe: {
      0: 'No engagement with affected communities.', 1: 'Engagement only when problems arise.',
      2: 'Informal engagement exists but is undocumented.',
      3: 'A documented stakeholder engagement process is in place.',
      4: 'A functioning grievance mechanism exists with tracked resolution.',
      5: 'Community legitimacy is independently assessed or monitored.',
    },
    evidence: 'Stakeholder engagement plan, grievance log, community feedback records.',
    recommendation: 'Use the CRAFT ESG Self-Assessment\'s community-engagement question directly - the same evidence satisfies both.',
    ladderRelevance: 'Loss of community legitimacy is one of the fastest ways an otherwise-strong institution loses its social licence to operate.',
  },

  // --- Level 5: Investability -----------------------------------------------
  {
    id: 'CRL-5A', level: 5, domain: 'Investment Case & Revenue Model',
    question: 'Is there a clear, credible case for why external capital would be repaid or create a return?',
    soe: {
      0: 'No investment case exists.', 1: 'An informal case exists but is not written down.',
      2: 'A written case exists but lacks supporting financial detail.',
      3: 'A documented investment case with a defined revenue model exists.',
      4: 'The case has been tested or validated against real performance data.',
      5: 'The investment case has been independently reviewed (e.g. by an advisor or prior investor).',
    },
    evidence: 'Business/investment case document, financial model, revenue data.',
    recommendation: 'Put the revenue model on one page with your actual historical numbers, not projections alone - credibility beats ambition at this stage.',
    ladderRelevance: 'This is the first rung where the question shifts from "is this institution sound" to "would I put capital into it".',
  },
  {
    id: 'CRL-5B', level: 5, domain: 'Cash-Flow Visibility & Bankability',
    question: 'Can the institution produce reliable, forward-looking cash-flow visibility?',
    soe: {
      0: 'No cash-flow forecasting exists.', 1: 'Informal forecasting, not documented.',
      2: 'A basic forecast exists but is not regularly updated.',
      3: 'A rolling cash-flow forecast (e.g. 13-week or quarterly) is maintained.',
      4: 'Forecasts are compared to actuals and variance is explained.',
      5: 'Forecast accuracy is tracked and has improved over multiple cycles.',
    },
    evidence: '13-week or quarterly cash-flow forecast, variance analysis, bank statements.',
    recommendation: 'Start a simple 13-week rolling cash-flow forecast - this single document is what most financiers ask for first.',
    ladderRelevance: 'Reuses the same cash-flow discipline CRAFT\'s GFA Business Diagnostic already scores under "Cash Management & Runway".',
  },
  {
    id: 'CRL-5C', level: 5, domain: 'Investor Protections & Regulatory Certainty',
    question: 'Does the institution operate in a way that gives external capital providers confidence in their protections?',
    soe: {
      0: 'No consideration of investor protections.', 1: 'Informal awareness, nothing documented.',
      2: 'Basic legal/contractual protections exist but are not standardized.',
      3: 'Standard investor protections (e.g. reporting rights, covenants) are documented.',
      4: 'Legal counsel has reviewed investment-readiness documentation.',
      5: 'The institution has successfully closed at least one external financing round under these protections.',
    },
    evidence: 'Sample term sheet or financing agreement, legal opinion, prior financing closing documents.',
    recommendation: 'Have a lawyer review your standard financing terms before you are mid-negotiation with a real investor.',
    ladderRelevance: 'Weak investor protections are a common reason term sheets stall even when the underlying institution is strong.',
  },

  // --- Level 6: Scale & Institutionalization ---------------------------------
  {
    id: 'CRL-6A', level: 6, domain: 'Institutional Depth & Systems',
    question: 'Does the institution rely on documented systems rather than individual heroics?',
    soe: {
      0: 'Everything depends on specific individuals, nothing documented.', 1: 'Some informal know-how exists.',
      2: 'Core processes are documented but inconsistently followed.',
      3: 'Core processes are documented and followed, with designated owners.',
      4: 'Systems are periodically reviewed and improved.',
      5: 'Systems have been stress-tested by rapid growth or staff turnover without disruption.',
    },
    evidence: 'Standard operating procedures, systems documentation, process ownership matrix.',
    recommendation: 'Document your three most critical processes first - the ones that would break the institution if the one person who knows them left.',
    ladderRelevance: 'An institution that cannot absorb more capital without its systems breaking has hit its scale ceiling.',
  },
  {
    id: 'CRL-6B', level: 6, domain: 'Data & Controls Maturity',
    question: 'Does the institution have the data infrastructure and controls to manage significantly more scale?',
    soe: {
      0: 'No structured data or controls infrastructure.', 1: 'Data exists in disconnected spreadsheets.',
      2: 'Some structured data systems exist but are not integrated.',
      3: 'Core financial and operational data is managed in structured systems.',
      4: 'Systems provide real-time or near-real-time management reporting.',
      5: 'Data and controls infrastructure has been independently reviewed for scale-readiness.',
    },
    evidence: 'Systems architecture overview, management reporting samples, IT/controls review.',
    recommendation: 'Consolidate your core financial data into one system before adding new capital that will multiply the reporting burden.',
    ladderRelevance: 'Data and controls debt is what most often causes a scaled-up institution to lose fiduciary trust just as it is growing fastest.',
  },
  {
    id: 'CRL-6C', level: 6, domain: 'Replicability & Partnerships',
    question: 'Can the institution\'s model be replicated or extended through partnerships without losing quality?',
    soe: {
      0: 'The model has never been tested beyond its original context.', 1: 'Replication has been discussed informally.',
      2: 'A pilot replication or partnership exists but is unevaluated.',
      3: 'At least one successful replication or partnership is documented.',
      4: 'A defined partnership/replication model exists with quality controls.',
      5: 'Multiple successful replications demonstrate the model travels without degrading.',
    },
    evidence: 'Partnership agreements, replication case studies, quality-assurance framework.',
    recommendation: 'Document what made your first successful partnership work - that becomes the template for the next one.',
    ladderRelevance: 'Replicability is what convinces a capital-markets-scale financier the institution is a platform, not a single project.',
  },

  // --- Level 7: Capital Market Readiness --------------------------------------
  {
    id: 'CRL-7A', level: 7, domain: 'Development Finance / DFI Readiness',
    question: 'Is the institution prepared to meet DFI due-diligence and safeguards requirements?',
    soe: {
      0: 'No awareness of DFI requirements.', 1: 'Informal awareness, no preparation.',
      2: 'Some DFI-style documentation exists but is incomplete.',
      3: 'A documented DFI-readiness data room exists (financial, ESG, legal).',
      4: 'The institution has engaged with a DFI pre-screening or expression-of-interest process.',
      5: 'The institution has closed a DFI facility.',
    },
    evidence: 'DFI-style data room, environmental and social safeguards documentation, prior DFI correspondence.',
    recommendation: 'Use the CRAFT GFA Business Diagnostic data room checklist as the starting point - it already matches most DFI/PE requirements.',
    ladderRelevance: 'See the ESG Self-Assessment\'s rating-agency translation for how DFIs and credit analysts frame institutional and ESG risk.',
  },
  {
    id: 'CRL-7B', level: 7, domain: 'Capital Markets & Credit Readiness',
    question: 'Could the institution withstand the scrutiny of a formal credit assessment process?',
    soe: {
      0: 'No consideration of credit-market readiness.', 1: 'Informal awareness, no preparation.',
      2: 'Some financial discipline exists but would not withstand formal scrutiny.',
      3: 'Financial reporting and controls would withstand a structured credit review.',
      4: 'The institution has engaged an advisor on credit or capital-markets readiness.',
      5: 'The institution has undergone a formal credit assessment or rating process.',
    },
    evidence: 'Audited financials, credit memo or advisor assessment, any prior rating correspondence.',
    recommendation: 'Read the ESG Self-Assessment\'s "How This Maps to Rating Agencies" section - it explains what a credit review actually looks for.',
    ladderRelevance: 'This is the top rung CRAFT itself is designed to help an institution reach - not to issue the rating, but to prepare for it.',
  },
  {
    id: 'CRL-7C', level: 7, domain: 'Sustainability-Linked / Green Finance Readiness',
    question: 'Could the institution structure or qualify for sustainability-linked, green or social financing?',
    soe: {
      0: 'No awareness of sustainability-linked finance.', 1: 'Informal interest, no preparation.',
      2: 'Some ESG data exists but not structured for financing use cases.',
      3: 'ESG and sustainability data is structured well enough to support a financing application.',
      4: 'The institution has engaged with a sustainability-linked or green financing process.',
      5: 'The institution has closed sustainability-linked, green or social financing.',
    },
    evidence: 'ESG Self-Assessment results, sustainability KPIs, any prior green/social financing documentation.',
    recommendation: 'Complete the CRAFT ESG Self-Assessment to "Verified" evidence status first - it is the direct input this financing route requires.',
    ladderRelevance: 'The institution that reaches this rung has, by definition, already climbed every rung below it.',
  },
]

export function indicatorsForLevel(level: number): LadderIndicator[] {
  return LADDER_INDICATORS.filter(i => i.level === level)
}

// ----------------------------------------------------------------------------
// Scoring - sequential ladder semantics, not a flat average.
// ----------------------------------------------------------------------------

const ACHIEVEMENT_THRESHOLD = 3.5 // mean indicator score needed to count a rung "achieved"

export function levelScore(level: number, scores: Record<string, number>): number {
  const inds = indicatorsForLevel(level)
  const answered = inds.filter(i => scores[i.id] != null)
  if (answered.length === 0) return 0
  const sum = answered.reduce((acc, i) => acc + (scores[i.id] ?? 0), 0)
  return Math.round((sum / answered.length) * 100) / 100
}

export function levelFullyAnswered(level: number, scores: Record<string, number>): boolean {
  return indicatorsForLevel(level).every(i => scores[i.id] != null)
}

export function levelAchieved(level: number, scores: Record<string, number>): boolean {
  return levelFullyAnswered(level, scores) && levelScore(level, scores) >= ACHIEVEMENT_THRESHOLD
}

/** The highest rung for which every level up to and including it is achieved. 0 if Level 1 isn't even achieved yet. */
export function currentRung(scores: Record<string, number>): number {
  let rung = 0
  for (const lvl of LADDER_LEVELS) {
    if (levelAchieved(lvl.level, scores)) rung = lvl.level
    else break
  }
  return rung
}

/** The next rung to climb toward (currentRung + 1), or null if the top rung is already achieved. */
export function nextRung(scores: Record<string, number>): LadderLevel | null {
  const rung = currentRung(scores)
  return LADDER_LEVELS.find(l => l.level === rung + 1) ?? null
}

/** Indicators at the next rung scoring below the achievement threshold - what's actually blocking the climb. */
export function blockingIndicators(scores: Record<string, number>): LadderIndicator[] {
  const next = nextRung(scores)
  if (!next) return []
  return indicatorsForLevel(next.level).filter(
    i => scores[i.id] == null || (scores[i.id] as number) < ACHIEVEMENT_THRESHOLD,
  )
}

/** Overall composite (0-5) across every answered indicator, for the headline stat alongside the rung. */
export function compositeLadderScore(scores: Record<string, number>): number {
  const answered = LADDER_INDICATORS.filter(i => scores[i.id] != null)
  if (answered.length === 0) return 0
  const sum = answered.reduce((acc, i) => acc + (scores[i.id] ?? 0), 0)
  return Math.round((sum / answered.length) * 100) / 100
}

export function totalAnswered(scores: Record<string, number>): number {
  return Object.keys(scores).filter(k => LADDER_INDICATORS.some(i => i.id === k)).length
}
