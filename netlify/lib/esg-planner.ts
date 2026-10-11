// CRAFT ESG & Sustainability Implementation Planner — framework catalogue and
// the SEC Nigeria IFRS S1/S2 implementation-plan template. Pure logic so it can
// be self-checked with `node netlify/lib/esg-planner.test.ts`.
//
// Content rules: requirement titles are short paraphrases with a link to the
// publisher, never reproduced standard text. Anything not verified against the
// publisher is marked `requiresVerification` so the UI can say so.

export type FrameworkCategory =
  | 'disclosure_standard' | 'regulatory_requirement' | 'accounting_standard'
  | 'questionnaire' | 'reporting_framework'
export type Obligation = 'mandatory' | 'mandatory_where_applicable' | 'voluntary'

export interface CatalogueFramework {
  name: string // stable key, stored as esg_frameworks.framework_name
  title: string
  category: FrameworkCategory
  publisher: string
  sourceUrl: string
  obligation: Obligation
  jurisdiction: string
  applicability: 'all' | 'sector_specific'
  version: string | null
  lastVerified: string | null
  requiresVerification: boolean
  note: string
  reqs: readonly (readonly [string, string, 'environmental' | 'social' | 'governance', 'high' | 'medium' | 'low'])[]
}

export const SEC_NG_FRAMEWORK = 'SEC-NG-IFRS'
export const SEC_NG_CIRCULAR = {
  title: 'Implementation of the IFRS Sustainability Disclosure Standards in Nigeria',
  issued: '2026-09-23',
  submissionDeadline: '2026-10-15',
  url: 'https://www.sec.gov.ng/for-investors/keep-track-of-circulars/implementation-of-the-ifrs-sustainability-disclosure-standards-in-nigeria/',
  appliesTo: 'Public companies and significant public interest capital market operators',
}

export const ESG_CATALOGUE: readonly CatalogueFramework[] = [
  {
    name: 'ESRS', title: 'ESRS / CSRD', category: 'regulatory_requirement', publisher: 'EFRAG / European Union',
    sourceUrl: 'https://www.efrag.org', obligation: 'mandatory_where_applicable', jurisdiction: 'EU', applicability: 'all',
    version: null, lastVerified: null, requiresVerification: true,
    note: 'Applies to in-scope EU undertakings and some non-EU groups; confirm scope and current phase-in.',
    reqs: [
      ['ESRS E1-1', 'Transition plan for climate change mitigation', 'environmental', 'high'],
      ['ESRS S1-1', 'Policies related to own workforce', 'social', 'medium'],
      ['ESRS G1-1', 'Business conduct policies and corporate culture', 'governance', 'high'],
    ],
  },
  {
    name: 'ISSB', title: 'IFRS S1 and IFRS S2', category: 'disclosure_standard', publisher: 'IFRS Foundation (ISSB)',
    sourceUrl: 'https://www.ifrs.org/groups/international-sustainability-standards-board/', obligation: 'mandatory_where_applicable',
    jurisdiction: 'global', applicability: 'all', version: null, lastVerified: null, requiresVerification: true,
    note: 'Mandatory only where a jurisdiction adopts it (e.g. Nigeria via the FRCN roadmap). Core content: governance, strategy, risk management, metrics and targets.',
    reqs: [
      ['IFRS S1-GOV', 'Governance of sustainability-related risks and opportunities', 'governance', 'high'],
      ['IFRS S1-STR', 'Strategy for sustainability-related risks and opportunities', 'governance', 'high'],
      ['IFRS S1-RM', 'Risk management processes for sustainability-related risks', 'governance', 'high'],
      ['IFRS S1-MT', 'Sustainability-related metrics and targets', 'governance', 'medium'],
      ['IFRS S2-GOV', 'Governance of climate-related risks and opportunities', 'governance', 'high'],
      ['IFRS S2-STR', 'Climate strategy, including transition planning and climate resilience', 'environmental', 'high'],
      ['IFRS S2-RM', 'Climate-related risk management processes', 'environmental', 'medium'],
      ['IFRS S2-MET', 'Climate-related metrics and targets (GHG emissions)', 'environmental', 'high'],
    ],
  },
  {
    name: 'GRI', title: 'GRI Standards', category: 'disclosure_standard', publisher: 'Global Reporting Initiative',
    sourceUrl: 'https://www.globalreporting.org/standards/', obligation: 'voluntary', jurisdiction: 'global', applicability: 'sector_specific',
    version: null, lastVerified: null, requiresVerification: true,
    note: 'Impact-focused reporting on the economy, environment and people.',
    reqs: [
      ['GRI 2-9', 'Governance structure and composition', 'governance', 'medium'],
      ['GRI 3-1', 'Process to determine material topics', 'governance', 'high'],
      ['GRI 305-1', 'Direct (Scope 1) GHG emissions', 'environmental', 'medium'],
      ['GRI 403-1', 'Occupational health and safety management system', 'social', 'medium'],
    ],
  },
  {
    name: 'SASB', title: 'SASB Standards', category: 'disclosure_standard', publisher: 'IFRS Foundation',
    sourceUrl: 'https://sasb.ifrs.org/', obligation: 'voluntary', jurisdiction: 'global', applicability: 'sector_specific',
    version: null, lastVerified: null, requiresVerification: true,
    note: 'Industry-specific disclosure topics and metrics; also referenced by IFRS S1 when identifying risks and opportunities.',
    reqs: [
      ['SASB-IND', 'Identify the applicable SASB industry and its disclosure topics', 'governance', 'high'],
      ['SASB-MET', 'Report the industry-specific metrics for each material topic', 'governance', 'medium'],
    ],
  },
  {
    name: 'TNFD', title: 'TNFD Recommendations', category: 'reporting_framework', publisher: 'Taskforce on Nature-related Financial Disclosures',
    sourceUrl: 'https://tnfd.global/', obligation: 'voluntary', jurisdiction: 'global', applicability: 'all',
    version: null, lastVerified: null, requiresVerification: true,
    note: 'Nature-related dependencies, impacts, risks and opportunities, using the LEAP approach.',
    reqs: [
      ['TNFD-LEAP', 'Apply the LEAP approach (Locate, Evaluate, Assess, Prepare)', 'environmental', 'high'],
      ['TNFD-GOV', 'Governance of nature-related issues', 'governance', 'medium'],
      ['TNFD-STR', 'Strategy for nature-related dependencies, impacts, risks and opportunities', 'environmental', 'medium'],
      ['TNFD-RIM', 'Nature-related risk and impact management', 'environmental', 'medium'],
      ['TNFD-MT', 'Nature-related metrics and targets', 'environmental', 'medium'],
    ],
  },
  {
    name: 'GHG Protocol', title: 'GHG Protocol', category: 'accounting_standard', publisher: 'GHG Protocol (WRI / WBCSD)',
    sourceUrl: 'https://ghgprotocol.org/', obligation: 'voluntary', jurisdiction: 'global', applicability: 'all',
    version: null, lastVerified: null, requiresVerification: true,
    note: 'An emissions accounting standard, not a disclosure standard; IFRS S2 requires GHG measurement in line with it unless an exception applies.',
    reqs: [
      ['GHG-BND', 'Set the organisational boundary (equity share or control approach)', 'environmental', 'high'],
      ['GHG-S1', 'Measure Scope 1 (direct) emissions', 'environmental', 'high'],
      ['GHG-S2', 'Measure Scope 2 (purchased energy) emissions, location- and market-based', 'environmental', 'high'],
      ['GHG-S3', 'Screen and measure relevant Scope 3 (value chain) categories', 'environmental', 'medium'],
    ],
  },
  {
    name: 'CDP', title: 'CDP disclosure', category: 'questionnaire', publisher: 'CDP',
    sourceUrl: 'https://www.cdp.net/', obligation: 'voluntary', jurisdiction: 'global', applicability: 'all',
    version: null, lastVerified: null, requiresVerification: true,
    note: 'A questionnaire-based disclosure system, typically requested by investors or customers.',
    reqs: [
      ['CDP-SCOPE', 'Confirm which CDP questionnaire and response cycle apply', 'governance', 'medium'],
      ['CDP-RESP', 'Prepare and submit the response with supporting data evidence', 'environmental', 'medium'],
    ],
  },
  {
    name: 'IR', title: 'Integrated Reporting Framework', category: 'reporting_framework', publisher: 'IFRS Foundation',
    sourceUrl: 'https://www.integratedreporting.ifrs.org/', obligation: 'voluntary', jurisdiction: 'global', applicability: 'all',
    version: null, lastVerified: null, requiresVerification: true,
    note: 'Integrated thinking and reporting on value creation over time.',
    reqs: [
      ['IR-CE', 'Cover the eight content elements, from organisational overview to basis of preparation', 'governance', 'medium'],
      ['IR-GP', 'Apply the guiding principles (e.g. connectivity, materiality, consistency)', 'governance', 'medium'],
    ],
  },
  {
    name: SEC_NG_FRAMEWORK, title: 'SEC Nigeria — IFRS S1/S2 Implementation Plan', category: 'regulatory_requirement',
    publisher: 'Securities and Exchange Commission, Nigeria', sourceUrl: SEC_NG_CIRCULAR.url, obligation: 'mandatory', jurisdiction: 'NG',
    applicability: 'all', version: `Circular of ${SEC_NG_CIRCULAR.issued}`, lastVerified: '2026-10-11', requiresVerification: false,
    note: `${SEC_NG_CIRCULAR.appliesTo} must submit an implementation plan by ${SEC_NG_CIRCULAR.submissionDeadline}. Check the SEC page for later updates.`,
    reqs: [
      ['SEC-NG-1', 'Governance arrangements for sustainability reporting, including Board oversight', 'governance', 'high'],
      ['SEC-NG-2', 'Gap assessment against the requirements of IFRS S1 and IFRS S2', 'governance', 'high'],
      ['SEC-NG-3', 'Implementation roadmap and timelines', 'governance', 'high'],
      ['SEC-NG-4', 'Data collection and reporting systems', 'environmental', 'high'],
      ['SEC-NG-5', 'Internal control and assurance arrangements', 'governance', 'high'],
      ['SEC-NG-6', 'Capacity building and training plans', 'social', 'medium'],
      ['SEC-NG-7', 'Expected year of first sustainability reporting in accordance with the FRCN Roadmap', 'governance', 'high'],
      ['SEC-NG-8', 'Key implementation challenges', 'governance', 'medium'],
    ],
  },
]

export function catalogueMeta(name: string) {
  const f = ESG_CATALOGUE.find((x) => x.name === name)
  if (!f) return null
  const { reqs: _reqs, ...meta } = f
  return meta
}

// --- SEC Nigeria plan generator ------------------------------------------------------
export type EntityType = 'public_company' | 'spicmo' | 'sme' | 'other'
export type Readiness = 'early' | 'developing' | 'advanced'
export type Horizon = '90d' | '12m' | '24m'
export const HORIZON_DAYS: Record<Horizon, number> = { '90d': 90, '12m': 365, '24m': 730 }

// SEC page: PIEs (incl. public companies and significant operators) — periods beginning on or after
// 1 Jan 2028; SMEs — 1 Jan 2030. Anything else must be confirmed by the user, never assumed.
export function defaultFirstReportingYear(entity: EntityType): number | null {
  if (entity === 'public_company' || entity === 'spicmo') return 2028
  if (entity === 'sme') return 2030
  return null
}

interface ElementTemplate {
  id: string
  owner: string
  window: [number, number] // fraction of the horizon
  milestones: [string, string, string]
  activities: string[]
  evidence: string[]
  dependsOn: string[]
  completion: string
  budget: string
}

export const SEC_NG_ELEMENTS: readonly ElementTemplate[] = [
  {
    id: 'SEC-NG-1', owner: 'Company Secretary with the Board committee chair', window: [0, 0.25],
    milestones: ['Draft oversight structure and responsibility map', 'Board or committee approval minuted', 'First sustainability-reporting update delivered to the Board'],
    activities: ['Assign Board-level oversight of sustainability reporting (committee terms of reference)', 'Designate an executive sponsor and a management reporting lead', 'Define the review and approval route for sustainability disclosures', 'Set the Board reporting cadence for implementation progress'],
    evidence: ['Approved Board or committee terms of reference covering sustainability', 'Board resolution or minutes', 'Responsibility (RACI) matrix'],
    dependsOn: [], completion: 'Board-approved oversight structure documented and minuted',
    budget: 'Board and secretariat time; optional external governance adviser',
  },
  {
    id: 'SEC-NG-2', owner: 'Sustainability lead with the CFO', window: [0, 0.4],
    milestones: ['Scoping memo: reporting entity and boundary confirmed', 'Gap assessment against IFRS S1 and S2 completed', 'Gap register prioritised and approved by the sponsor'],
    activities: ['Confirm the reporting entity and boundary, aligned with the financial statements', 'Assess current disclosures and processes against IFRS S1/S2 core content (governance, strategy, risk management, metrics and targets)', 'Identify sustainability- and climate-related risks and opportunities', 'Record each gap with priority and owner in the CRAFT corrective action plan'],
    evidence: ['Scoping memo', 'Gap assessment register', 'Sponsor approval record'],
    dependsOn: ['SEC-NG-1'], completion: 'Prioritised gap register approved by the executive sponsor',
    budget: 'Finance and sustainability staff time; optional external adviser for the assessment',
  },
  {
    id: 'SEC-NG-3', owner: 'Implementation lead (programme office)', window: [0.3, 0.5],
    milestones: ['Draft roadmap with workstreams, owners and dates', 'Roadmap approved by the Board or committee', 'First periodic progress review held'],
    activities: ['Convert prioritised gaps into workstreams with owners and dates', 'Align the timeline with the first reporting period', 'Map dependencies and the critical path', 'Set progress reporting to management and the Board'],
    evidence: ['Approved roadmap', 'Progress reports'],
    dependsOn: ['SEC-NG-2'], completion: 'Roadmap approved and progress reported on the agreed cadence',
    budget: 'Programme management time',
  },
  {
    id: 'SEC-NG-4', owner: 'CFO and Head of IT with functional data owners', window: [0.35, 0.9],
    milestones: ['Metric inventory, definitions and data owners agreed', 'Collection process or system ready', 'Dry-run data collection completed for one period'],
    activities: ['Inventory the metrics required, including GHG emissions where IFRS S2 applies', 'Assign data owners, definitions and calculation methods', 'Select or adapt collection tools and reporting systems', 'Run a dry-run collection and reconcile results'],
    evidence: ['Data inventory and dictionary', 'Data-owner matrix', 'System or process design', 'Dry-run output and reconciliation'],
    dependsOn: ['SEC-NG-2', 'SEC-NG-3'], completion: 'Dry-run data collection completed and reconciled for a full period',
    budget: 'System or tooling cost to be estimated once the metric inventory is complete',
  },
  {
    id: 'SEC-NG-5', owner: 'Chief Risk Officer with the Head of Internal Audit', window: [0.5, 1],
    milestones: ['Controls over sustainability data designed', 'Controls tested on dry-run data', 'Assurance readiness assessed'],
    activities: ['Design review, reconciliation and sign-off controls over sustainability data', 'Include sustainability reporting in the internal audit plan', 'Assess readiness for external assurance and its likely timing'],
    evidence: ['Control matrix', 'Internal audit plan', 'Control test results', 'Assurance readiness assessment'],
    dependsOn: ['SEC-NG-4'], completion: 'Controls documented and tested on dry-run data',
    budget: 'Internal audit time; external assurance fees to be scoped separately where required',
  },
  {
    id: 'SEC-NG-6', owner: 'Head of HR / Learning with the implementation lead', window: [0.1, 1],
    milestones: ['Training needs analysis and plan approved', 'Board briefing on IFRS S1/S2 delivered', 'Role-based training completed for data contributors'],
    activities: ['Analyse training needs for the Board, finance, operations and data contributors', 'Brief the Board on IFRS S1/S2 obligations', 'Deliver role-based training and track completion'],
    evidence: ['Training plan', 'Attendance and completion records'],
    dependsOn: ['SEC-NG-1'], completion: 'Training plan delivered to every defined audience',
    budget: 'Training provider and staff time',
  },
  {
    id: 'SEC-NG-7', owner: 'CFO with the Company Secretary', window: [0, 0.2],
    milestones: ['Entity classification and applicable FRCN date confirmed', 'Transition reliefs the entity intends to use analysed', 'Board confirms the first reporting period'],
    activities: ['Confirm the entity classification and the applicable FRCN Roadmap date', 'Document the first reporting period and any transition reliefs the entity intends to apply', 'Obtain Board confirmation'],
    evidence: ['Board-approved statement of the first reporting period', 'Supporting classification analysis'],
    dependsOn: ['SEC-NG-1'], completion: 'First reporting period confirmed and recorded',
    budget: 'Finance and secretariat time; legal or advisory input if classification is uncertain',
  },
  {
    id: 'SEC-NG-8', owner: 'Implementation lead', window: [0.15, 1],
    milestones: ['Initial challenge log with mitigations', 'Owners assigned to each mitigation', 'Challenge log reviewed at a progress update'],
    activities: ['Identify challenges (data availability, value-chain data, skills, systems, cost, assurance capacity)', 'Agree a mitigation and owner for each challenge', 'Review the log at every progress update'],
    evidence: ['Challenge and mitigation log', 'Progress update minutes'],
    dependsOn: ['SEC-NG-2'], completion: 'Challenge log maintained and reported at each progress update',
    budget: 'Programme management time',
  },
]

export const READINESS_FOCUS: Record<Readiness, string> = {
  early: 'Early-stage: put governance (1), the gap assessment (2) and the metric inventory (4) first; expect to build most systems from scratch.',
  developing: 'Developing: formalise existing policies and data flows, then close the gaps the assessment surfaces.',
  advanced: 'Advanced: review existing reporting and controls against IFRS S1/S2 and focus on assurance readiness.',
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + Math.round(days))
  return d.toISOString().slice(0, 10)
}

export interface GeneratedElement {
  requirementId: string
  owner: string
  timelineStart: string
  timelineEnd: string
  milestones: { milestoneNum: number; description: string; targetDate: string }[]
}

// Deterministic: same inputs → same plan. Milestones split each element's window into thirds.
export function generateSecPlan(startDate: string, horizon: Horizon): GeneratedElement[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error('startDate must be YYYY-MM-DD')
  const total = HORIZON_DAYS[horizon]
  return SEC_NG_ELEMENTS.map((e) => {
    const s = e.window[0] * total
    const len = (e.window[1] - e.window[0]) * total
    return {
      requirementId: e.id,
      owner: e.owner,
      timelineStart: addDays(startDate, s),
      timelineEnd: addDays(startDate, s + len),
      milestones: e.milestones.map((description, i) => ({ milestoneNum: i + 1, description, targetDate: addDays(startDate, s + (len * (i + 1)) / 3) })),
    }
  })
}

// --- Export -------------------------------------------------------------------------------
export interface PlanSettings {
  organisationName: string
  entityType: EntityType
  readiness: Readiness
  horizon: Horizon
  startDate: string
  firstReportingYear: number | null
}

export interface PlanRow {
  requirementId: string
  requirementText: string
  owner: string | null
  status: string
  timelineStart: string | null
  timelineEnd: string | null
  milestones: { milestoneNum: number; description: string; targetDate: string | null; status: string; completionEvidenceLink: string | null }[]
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)
const list = (xs: string[]) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`

const ENTITY_LABEL: Record<EntityType, string> = {
  public_company: 'Public company', spicmo: 'Significant public interest capital market operator', sme: 'Small or medium-sized entity', other: 'Other organisation / voluntary adopter',
}

export function firstReportingLine(year: number | null): string {
  return year
    ? `First in-scope reporting period begins on or after 1 January ${year}. Confirm against the FRCN Roadmap for this entity.`
    : 'First reporting period not yet confirmed — requires confirmation against the FRCN Roadmap.'
}

// Word-compatible HTML: opens and edits in Word / LibreOffice / Google Docs.
export function renderPlanDoc(settings: PlanSettings, rows: PlanRow[], generatedOn: string): string {
  const byId = new Map(rows.map((r) => [r.requirementId, r]))
  const sections = SEC_NG_ELEMENTS.map((t, i) => {
    const r = byId.get(t.id)
    const ms = r?.milestones ?? []
    return `<h2>${i + 1}. ${esc(r?.requirementText ?? t.id)}</h2>
<p><b>Accountable owner:</b> ${esc(r?.owner || t.owner)} &nbsp; <b>Timeline:</b> ${esc(r?.timelineStart ?? '—')} to ${esc(r?.timelineEnd ?? '—')} &nbsp; <b>Status:</b> ${esc(r?.status ?? 'not_started')}</p>
${t.id === 'SEC-NG-7' ? `<p><b>${esc(firstReportingLine(settings.firstReportingYear))}</b></p>` : ''}
<h3>Activities</h3>${list(t.activities)}
<h3>Milestones</h3><table border="1" cellpadding="4" cellspacing="0"><tr><th>#</th><th>Milestone</th><th>Target date</th><th>Status</th><th>Completion evidence</th></tr>
${ms.map((m) => `<tr><td>${m.milestoneNum}</td><td>${esc(m.description)}</td><td>${esc(m.targetDate ?? '')}</td><td>${esc(m.status)}</td><td>${esc(m.completionEvidenceLink ?? '')}</td></tr>`).join('')}</table>
<h3>Required evidence</h3>${list(t.evidence)}
<p><b>Dependencies:</b> ${esc(t.dependsOn.length ? t.dependsOn.join(', ') : 'None')}<br><b>Completion indicator:</b> ${esc(t.completion)}<br><b>Budget assumption:</b> ${esc(t.budget)}</p>`
  }).join('\n')
  return `<!doctype html><html><head><meta charset="utf-8"><title>IFRS S1/S2 Implementation Plan — ${esc(settings.organisationName)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.4}h1{font-size:18pt}h2{font-size:14pt;margin-top:18pt}h3{font-size:11pt}table{border-collapse:collapse;width:100%}th{background:#e8f5ee;text-align:left}</style></head><body>
<h1>IFRS S1/S2 Implementation Plan</h1>
<p><b>Organisation:</b> ${esc(settings.organisationName)}<br><b>Organisation type:</b> ${esc(ENTITY_LABEL[settings.entityType])}<br><b>Planning horizon:</b> ${esc(settings.horizon)} from ${esc(settings.startDate)}<br><b>Generated:</b> ${esc(generatedOn)} with CRAFT</p>
<p><b>Regulatory basis:</b> SEC Nigeria circular “${esc(SEC_NG_CIRCULAR.title)}” (${esc(SEC_NG_CIRCULAR.issued)}), ${esc(SEC_NG_CIRCULAR.url)}.<br>
<b>SEC submission deadline:</b> ${esc(SEC_NG_CIRCULAR.submissionDeadline)} for ${esc(SEC_NG_CIRCULAR.appliesTo.toLowerCase())}. This is separate from the first reporting year (section 7).</p>
<p><b>Starting point:</b> ${esc(READINESS_FOCUS[settings.readiness])}</p>
${sections}
<h2>Limitations</h2><p>This plan is generated from the eight minimum elements in the SEC circular and edited by the organisation. It is not legal advice, regulatory approval, assurance or a statement of compliance with IFRS S1/S2. Confirm applicability, dates and any later SEC or FRCN updates against the official sources.</p>
</body></html>`
}

export function planCsv(rows: PlanRow[], escape: (v: unknown) => string): string {
  const head = ['element', 'requirement', 'owner', 'status', 'start', 'end', 'milestone_no', 'milestone', 'target_date', 'milestone_status', 'completion_evidence']
  const lines = rows.flatMap((r) => (r.milestones.length ? r.milestones : [null]).map((m) =>
    [r.requirementId, r.requirementText, r.owner, r.status, r.timelineStart, r.timelineEnd, m?.milestoneNum, m?.description, m?.targetDate, m?.status, m?.completionEvidenceLink].map(escape).join(',')))
  return [head.join(','), ...lines].join('\n')
}
