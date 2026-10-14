// CRAFT Interactive ESG Report Quality Checklist — jurisdiction rule packs, check catalogue,
// applicability engine, scoring and readiness gates. Shared by the UI and the API.
// Self-check: `node src/lib/esg-checklist.test.ts`.
//
// Product principle: reward evidence of implementation, not the mere existence of paperwork.
// Regulatory facts carry their source and the date they were checked; anything not confirmed
// against the primary source is flagged `requiresVerification`.

import { AFRICA_COUNTRIES, COUNTRY_SOURCES, countryByIso, REC_LABELS, type AfricaCountry } from './africa-countries.ts'

// 1.3: jurisdiction packs for all 54 African countries (CRAFT-AFR registry) and JUR-02.
export const CHECKLIST_VERSION = 'CRAFT-QA 1.3 (2026-10-14)'

// --- Jurisdiction rule packs ------------------------------------------------------------
export interface EntityCategory {
  id: string
  label: string
  mandatoryFrom: string | null // periods BEGINNING on or after this date
  fullFrom?: string // where a phase-in reaches full ISSB Standards later
  scopeByPhase?: { from: string; scope: Scope; note: string }[]
  basis?: 'IFRS' | 'IPSASB'
  note?: string
}
export type Scope = 'full' | 'climate_only' | 'exchange_esg_guidelines'

export interface Jurisdiction {
  code: string
  name: string
  authority: string
  sourceTitle: string
  sourceUrl: string
  lastVerified: string | null
  requiresVerification: boolean
  voluntaryFrom: string | null
  categories: EntityCategory[]
  note: string
  // Capital-market context from the 54-country registry (absent for OTHER).
  market?: { regulator: string | null; exchanges: string[]; esgDisclosure: string | null; accountancyBody: string | null; blocs: string[]; verify: string[] }
}

const IFRS_PROFILES = 'https://www.ifrs.org/ifrs-sustainability-disclosure-standards-around-the-world/use-by-jurisdiction/'

export const JURISDICTIONS: Jurisdiction[] = [
  {
    code: 'NG', name: 'Nigeria', authority: 'Financial Reporting Council of Nigeria (FRCN); Securities and Exchange Commission (SEC)',
    sourceTitle: 'FRCN Sustainability Reporting Guideline 1 (2026); SEC circular of 23 September 2026',
    sourceUrl: 'https://frcnigeria.gov.ng/wp-content/uploads/2026/02/Sustainability-Reporting-Guideline-SRG1-in-Nigeria-2026-SRG-.pdf',
    lastVerified: '2026-10-11', requiresVerification: false, voluntaryFrom: '2024-01-01',
    categories: [
      { id: 'ng_pie', label: 'Public interest entity (incl. public companies, significant capital market operators)', mandatoryFrom: '2028-01-01' },
      { id: 'ng_cpse', label: 'Commercial Public Sector Entity (formerly GBE)', mandatoryFrom: '2028-01-01' },
      { id: 'ng_sme', label: 'Small or medium-sized entity', mandatoryFrom: '2030-01-01' },
      { id: 'ng_public', label: 'Public sector entity (IPSASB sustainability standards)', mandatoryFrom: null, basis: 'IPSASB', note: 'SRG 1 directs public sector entities to IPSASB sustainability standards; confirm the applicable date with FRCN.' },
      { id: 'ng_other', label: 'Other / voluntary adopter', mandatoryFrom: null },
    ],
    note: 'Mandatory period starts with accounting periods beginning on or after 1 January 2028; a period beginning in 2027 and ending in 2028 is not mandatory (SRG 1 §18).',
  },
  {
    code: 'KE', name: 'Kenya', authority: 'Institute of Certified Public Accountants of Kenya (ICPAK)',
    sourceTitle: 'ICPAK advisory on timelines and readiness requirements (27 March 2026)',
    sourceUrl: 'https://www.icpak.com/advisory-on-timelines-and-readiness-requirements-for-kenyan-entities-reporting-on-the-ifrs-sustainability-disclosure-standards-ifrs-s1-general-requirements-for-disclosure-of-sustainability',
    lastVerified: '2026-10-11', requiresVerification: false, voluntaryFrom: '2024-01-01',
    categories: [
      { id: 'ke_pie', label: 'Public interest entity (NSE-listed, banks, insurers, pension schemes, fund managers, deposit-taking SACCOs, large state corporations on IFRS)', mandatoryFrom: '2027-01-01' },
      { id: 'ke_large', label: 'Large non-PIE enterprise', mandatoryFrom: '2028-01-01' },
      { id: 'ke_sme', label: 'Small or medium-sized entity', mandatoryFrom: '2029-01-01' },
      { id: 'ke_gov', label: 'Government organisation reporting on IPSAS', mandatoryFrom: '2028-07-01', note: 'ICPAK advisory Phase 3; confirm the applicable sustainability standard.' },
    ],
    note: 'PIEs must submit a Sustainability Reporting Readiness Assessment to ICPAK six months before their first mandatory period.',
  },
  {
    code: 'GH', name: 'Ghana', authority: 'Institute of Chartered Accountants, Ghana (ICAG)',
    sourceTitle: 'IFRS Foundation jurisdictional profile: Ghana (ICAG roadmap)', sourceUrl: 'https://www.ifrs.org/content/dam/ifrs/publications/sustainability-jurisdictions/pdf-profiles/ghana-ifrs-profile.pdf',
    lastVerified: '2026-10-11', requiresVerification: false, voluntaryFrom: '2024-01-01',
    categories: [
      { id: 'gh_spie', label: 'Significant public interest entity (listed, banks, insurers, corporate trustees, pension schemes, PLCs, holding companies of regulated entities)', mandatoryFrom: '2027-01-01' },
      { id: 'gh_sector', label: 'High-impact sector (upstream oil and gas, mining, refineries, automobile, cement, non-renewable power)', mandatoryFrom: '2027-01-01' },
      { id: 'gh_other', label: 'Other mandatory adopter', mandatoryFrom: '2028-01-01' },
      { id: 'gh_nonmandatory', label: 'Non-mandatory company', mandatoryFrom: null },
    ],
    note: 'ICAG said it would decide the public sector date once IPSASB issues its standards.',
  },
  {
    code: 'ZM', name: 'Zambia', authority: 'Zambia Institute of Chartered Accountants (ZICA)',
    sourceTitle: 'IFRS Foundation jurisdictional profile: Zambia', sourceUrl: 'https://www.ifrs.org/content/dam/ifrs/publications/sustainability-jurisdictions/pdf-profiles/zambia-ifrs-profile.pdf',
    lastVerified: '2026-10-11', requiresVerification: false, voluntaryFrom: null,
    categories: [
      { id: 'zm_pae', label: 'Publicly accountable entity (securities traded or being issued in public markets)', mandatoryFrom: '2025-01-01' },
      { id: 'zm_other', label: 'Other organisation (voluntary)', mandatoryFrom: null },
    ],
    note: '',
  },
  {
    code: 'TZ', name: 'Tanzania', authority: 'National Board of Accountants and Auditors (NBAA)',
    sourceTitle: 'NBAA Technical Pronouncement No. 1 of 2024 (IFRS Foundation profile)', sourceUrl: 'https://www.ifrs.org/content/dam/ifrs/publications/sustainability-jurisdictions/pdf-profiles/tanzania-ifrs-profile.pdf',
    lastVerified: '2026-10-11', requiresVerification: false, voluntaryFrom: null,
    categories: [
      { id: 'tz_pie', label: 'Public interest entity (listed or meeting NBAA thresholds)', mandatoryFrom: '2025-01-01' },
      { id: 'tz_public', label: 'Public sector entity', mandatoryFrom: '2025-01-01' },
      { id: 'tz_other', label: 'Other organisation', mandatoryFrom: null },
    ],
    note: 'Scope 3 relief may extend up to three years under the pronouncement.',
  },
  {
    code: 'ZW', name: 'Zimbabwe', authority: 'Public Accountants and Auditors Board (PAAB)',
    sourceTitle: 'Roadmap for Adoption of Sustainability Reporting in Zimbabwe (11 April 2026), IFRS Foundation profile',
    sourceUrl: 'https://www.ifrs.org/content/dam/ifrs/publications/sustainability-jurisdictions/pdf-profiles/zimbabwe-ifrs-profile.pdf',
    lastVerified: '2026-10-11', requiresVerification: false, voluntaryFrom: null,
    categories: [
      { id: 'zw_cat1', label: 'Category 1 (listed, banks and building societies, SOEs on IFRS, high environmental impact entities)', mandatoryFrom: '2028-01-01', fullFrom: '2031-01-01' },
      { id: 'zw_cat2', label: 'Category 2 (non-listed insurers, life and funeral assurers, deposit-taking MFIs, pension funds, other PIEs)', mandatoryFrom: '2029-01-01', fullFrom: '2032-01-01' },
      { id: 'zw_cat3', label: 'Category 3 (entities without public interest as defined by PAAB)', mandatoryFrom: '2030-01-01', fullFrom: '2033-01-01' },
      { id: 'zw_other', label: 'Other organisation', mandatoryFrom: null },
    ],
    note: 'Mandatory phases begin subject to transition adoption reliefs; full ISSB compliance follows three years later.',
  },
  {
    code: 'RW', name: 'Rwanda', authority: 'Institute of Certified Public Accountants of Rwanda (ICPAR)',
    sourceTitle: 'IFRS Foundation jurisdictional profile: Rwanda', sourceUrl: 'https://www.ifrs.org/content/dam/ifrs/publications/sustainability-jurisdictions/pdf-profiles/rwanda-ifrs-profile.pdf',
    lastVerified: '2026-10-11', requiresVerification: false, voluntaryFrom: null,
    categories: [
      { id: 'rw_g1_listed', label: 'Group 1 — listed entity', mandatoryFrom: '2025-01-01', fullFrom: '2027-01-01', scopeByPhase: [
        { from: '2025-01-01', scope: 'exchange_esg_guidelines', note: 'Initial phase: RSE ESG Guidelines (GRI-based).' },
        { from: '2026-01-01', scope: 'climate_only', note: 'Intermediate phase: simplified, climate-only ISSB.' },
        { from: '2027-01-01', scope: 'full', note: 'Full ISSB Standards.' },
      ] },
      { id: 'rw_g1', label: 'Group 1 — Tier I financial institution (banks, insurers)', mandatoryFrom: '2025-01-01', fullFrom: '2027-01-01', scopeByPhase: [
        { from: '2025-01-01', scope: 'climate_only', note: 'Initial phase: simplified, climate-only ISSB.' },
        { from: '2026-01-01', scope: 'climate_only', note: 'Intermediate phase: climate and environmental reporting.' },
        { from: '2027-01-01', scope: 'full', note: 'Full ISSB Standards.' },
      ] },
      { id: 'rw_g2', label: 'Group 2 — public utilities, Tier II and III financial institutions', mandatoryFrom: '2026-01-01', fullFrom: '2028-01-01', scopeByPhase: [
        { from: '2026-01-01', scope: 'climate_only', note: 'Initial phase: simplified, climate-only ISSB.' },
        { from: '2028-01-01', scope: 'full', note: 'Full ISSB Standards.' },
      ] },
      { id: 'rw_g3', label: 'Group 3 — other IFRS reporters and Tier IV financial institutions', mandatoryFrom: '2027-01-01', fullFrom: '2029-01-01', scopeByPhase: [
        { from: '2027-01-01', scope: 'climate_only', note: 'Initial phase: simplified, climate-only ISSB.' },
        { from: '2029-01-01', scope: 'full', note: 'Full ISSB Standards.' },
      ] },
      { id: 'rw_g4', label: 'Group 4 — IFRS for SMEs reporters', mandatoryFrom: '2028-01-01', scopeByPhase: [
        { from: '2028-01-01', scope: 'climate_only', note: 'Simplified framework.' },
      ] },
    ],
    note: 'Phased adoption with simplified, climate-only requirements before full ISSB Standards.',
  },
  {
    code: 'ZA', name: 'South Africa', authority: 'Johannesburg Stock Exchange (JSE)',
    sourceTitle: 'JSE Sustainability and Climate Disclosure Guidance (voluntary)', sourceUrl: IFRS_PROFILES,
    lastVerified: null, requiresVerification: true, voluntaryFrom: null,
    categories: [{ id: 'za_any', label: 'Any entity (no mandatory ISSB adoption identified)', mandatoryFrom: null }],
    note: 'No mandatory ISSB adoption found in the IFRS Foundation list (checked 2026-10-11); confirm current JSE and regulator requirements.',
  },
  {
    code: 'OTHER', name: 'Other jurisdiction (outside Africa)', authority: 'To be confirmed', sourceTitle: 'IFRS Foundation — use by jurisdiction', sourceUrl: IFRS_PROFILES,
    lastVerified: null, requiresVerification: true, voluntaryFrom: null,
    categories: [{ id: 'other', label: 'Entity (set adoption status manually)', mandatoryFrom: null }],
    note: 'No CRAFT rule pack yet: record the applicable requirement and source manually.',
  },
]

// --- Organisation/period profile and applicability -------------------------------------------
export interface QaProfile {
  jurisdiction: string
  category: string
  adoptingVoluntarily: boolean
  financialActivities: boolean // asset management, commercial banking or insurance (financed emissions)
  secScope: boolean // NG: public company / significant public interest capital market operator under the SEC circular
  mofiScope: boolean // NG: MOFI portfolio / binding mandate
  mofiOverlay: boolean // optional benchmark when not in MOFI scope
}

export type IfrsStatus = 'mandatory' | 'voluntary' | 'not_required' | 'other_basis'
export interface Applicability {
  status: IfrsStatus
  scope: Scope
  effectiveFrom: string | null
  note: string
  sourceUrl: string
  requiresVerification: boolean
}

// Countries without a detailed rule pack get a generated one from the registry: no mandatory
// IFRS S1/S2 date is assumed, and every such pack is flagged for verification.
const marketOf = (c: AfricaCountry): NonNullable<Jurisdiction['market']> => ({
  regulator: c.regulator, exchanges: c.exchanges, esgDisclosure: c.esgDisclosure, accountancyBody: c.accountancyBody,
  blocs: [...c.recs.map((r) => REC_LABELS[r]), ...(c.monetaryUnion ? [c.monetaryUnion] : []), ...(c.ohada ? ['OHADA'] : [])], verify: c.verify,
})
function generatedPack(c: AfricaCountry): Jurisdiction {
  const id = c.iso2.toLowerCase()
  const listed = c.exchanges.length ? [{ id: `${id}_listed`, label: `Listed on ${c.exchanges.join(' / ')}`, mandatoryFrom: null }] : []
  const ifrsNote = c.ifrs === 'snapshot' ? 'The IFRS Foundation has published a snapshot of a proposed ISSB framework (may change before adoption).' : 'Not on the IFRS Foundation list of jurisdictions adopting ISSB Standards (checked 14 October 2026).'
  return {
    code: c.iso2, name: c.name,
    authority: [c.regulator, c.accountancyBody].filter(Boolean).join('; ') || 'No securities regulator or accountancy body recorded',
    sourceTitle: COUNTRY_SOURCES.ifrs.title, sourceUrl: COUNTRY_SOURCES.ifrs.url, lastVerified: null, requiresVerification: true, voluntaryFrom: null,
    categories: [
      ...listed,
      { id: `${id}_regulated`, label: 'Regulated financial institution or other public interest entity', mandatoryFrom: null },
      { id: `${id}_public`, label: 'Public sector entity', mandatoryFrom: null, note: 'Confirm whether IPSASB sustainability standards or national public-sector guidance apply.' },
      { id: `${id}_other`, label: 'Other organisation (set adoption status manually)', mandatoryFrom: null },
    ],
    note: `${ifrsNote}${c.esgDisclosure ? ` Sustainability disclosure: ${c.esgDisclosure}.` : ''} No mandatory IFRS S1/S2 date is assumed; record the applicable requirement and its source.`,
    market: marketOf(c),
  }
}
for (const c of AFRICA_COUNTRIES) {
  const existing = JURISDICTIONS.find((j) => j.code === c.iso2)
  if (existing) existing.market = marketOf(c)
  else JURISDICTIONS.push(generatedPack(c))
}
JURISDICTIONS.sort((a, b) => (a.code === 'OTHER' ? 1 : b.code === 'OTHER' ? -1 : a.name.localeCompare(b.name)))

export const jurisdictionByCode = (code: string) => JURISDICTIONS.find((j) => j.code === code) ?? null

export function ifrsApplicability(profile: QaProfile, periodStart: string): Applicability {
  const j = jurisdictionByCode(profile.jurisdiction) ?? jurisdictionByCode('OTHER')!
  const cat = j.categories.find((c) => c.id === profile.category)
  const base = { sourceUrl: j.sourceUrl, requiresVerification: j.requiresVerification }
  if (cat?.basis === 'IPSASB') return { ...base, status: 'other_basis', scope: 'full', effectiveFrom: null, note: cat.note ?? 'Reports under IPSASB sustainability standards, not IFRS S1/S2.' }
  if (cat?.mandatoryFrom && periodStart >= cat.mandatoryFrom) {
    const phase = [...(cat.scopeByPhase ?? [])].reverse().find((p) => periodStart >= p.from)
    return { ...base, status: 'mandatory', scope: phase?.scope ?? 'full', effectiveFrom: cat.mandatoryFrom, note: [phase?.note, cat.note, j.note].filter(Boolean).join(' ') }
  }
  if (profile.adoptingVoluntarily) return { ...base, status: 'voluntary', scope: 'full', effectiveFrom: cat?.mandatoryFrom ?? null, note: 'Voluntary adoption: checks apply as the entity has chosen to report under IFRS S1/S2.' }
  return { ...base, status: 'not_required', scope: 'full', effectiveFrom: cat?.mandatoryFrom ?? null, note: cat?.mandatoryFrom ? `Not yet mandatory: periods beginning on or after ${cat.mandatoryFrom}.` : 'No mandatory requirement identified for this category.' }
}

// --- Check catalogue --------------------------------------------------------------------------
export type ReqClass = 'M-REG' | 'M-STD' | 'M-GOV' | 'C-MAND' | 'GP' | 'CRAFT'
export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type Pack = 'GQ' | 'S1' | 'S2' | 'SEC' | 'FRC' | 'MOFI' | 'EC' | 'JUR'
export interface Check {
  id: string
  pack: Pack
  title: string
  classes: ReqClass[]
  severity: Severity
  acceptance: string
  evidence: string
  provisional?: boolean
  condition?: (p: QaProfile, a: Applicability) => boolean
  conditionNote?: string
}

export const CLASS_LABELS: Record<ReqClass, string> = {
  'M-REG': 'Mandatory regulatory requirement', 'M-STD': 'Mandatory standard requirement', 'M-GOV': 'Mandatory governance mandate',
  'C-MAND': 'Conditionally mandatory', GP: 'Good practice', CRAFT: 'CRAFT assessment rule',
}
export const PACK_LABELS: Record<Pack, string> = {
  GQ: 'General quality', S1: 'IFRS S1', S2: 'IFRS S2', SEC: 'SEC Nigeria', FRC: 'FRCN SRG 1',
  MOFI: 'MOFI-aligned governance', EC: 'Evidence and controls', JUR: 'Jurisdiction',
}

type Row = [string, string, string, Severity, string, string]
const mk = (pack: Pack, rows: Row[], extra: Record<string, Partial<Check>> = {}): Check[] =>
  rows.map(([id, title, cls, severity, acceptance, evidence]) => ({ id, pack, title, classes: cls.split('/') as ReqClass[], severity, acceptance, evidence, ...extra[id] }))

const financed = { condition: (p: QaProfile) => p.financialActivities, conditionNote: 'Applies where activities include asset management, commercial banking or insurance.' }

// CRAFT general quality baseline: 30 checks supplied on 11 October 2026 and approved by the
// product owner on 12 October 2026 as the canonical baseline. Change only through a new checklist version.
type Gq = [string, string]
const gq = (group: string, rows: Gq[]): Check[] => rows.map(([id, q]) => ({
  id, pack: 'GQ', title: `${group}: ${q.replace(/\?$/, '')}`, classes: ['GP'], severity: 'medium', acceptance: q,
  evidence: 'Report section and supporting records',
}))

export const CHECKS: Check[] = [
  ...gq('Scope and completeness', [
    ['GQ-01', 'Does the report identify the reporting entity, reporting period and reporting boundary?'],
    ['GQ-02', 'Does it state the reporting basis, standards and frameworks used?'],
    ['GQ-03', 'Are exclusions, limitations and departures from the stated reporting basis disclosed?'],
    ['GQ-04', 'Does the report address the organisation’s material ESG topics for the period?'],
    ['GQ-05', 'Are terminology, definitions and reporting structure consistent throughout?'],
  ]),
  ...gq('Governance and accountability', [
    ['GQ-06', 'Does the report describe Board oversight of sustainability-related matters?'],
    ['GQ-07', 'Are management responsibilities for ESG risks, data and disclosures assigned?'],
    ['GQ-08', 'Are processes for monitoring and managing sustainability performance described?'],
    ['GQ-09', 'Are relevant policies and governance arrangements supported by evidence?'],
    ['GQ-10', 'Does the report distinguish current practice from planned improvements?'],
  ]),
  ...gq('Materiality, risks and strategy', [
    ['GQ-11', 'Is the process for identifying and assessing material sustainability matters explained?'],
    ['GQ-12', 'Are material sustainability-related risks and opportunities identified?'],
    ['GQ-13', 'Does the report explain how material matters affect strategy and decisions?'],
    ['GQ-14', 'Are relevant impacts on the business model, operations and value chain addressed?'],
    ['GQ-15', 'Are material financial implications and uncertainties explained where relevant?'],
  ]),
  ...gq('Metrics and performance', [
    ['GQ-16', 'Are quantitative indicators defined with units, boundaries and reporting periods?'],
    ['GQ-17', 'Are baselines, targets, milestones and progress disclosed where relevant?'],
    ['GQ-18', 'Are calculation methods, assumptions, estimates and data sources documented?'],
    ['GQ-19', 'Are comparisons meaningful, with material changes and restatements explained?'],
    ['GQ-20', 'Are indicators sufficiently disaggregated to support interpretation?'],
  ]),
  ...gq('Data quality and evidence', [
    ['GQ-21', 'Can material reported figures be traced to source records or evidence?'],
    ['GQ-22', 'Are data owners, reviewers and approval responsibilities documented?'],
    ['GQ-23', 'Are controls in place to validate, reconcile and review ESG data?'],
    ['GQ-24', 'Are missing data, estimates, uncertainties and limitations disclosed?'],
    ['GQ-25', 'Is there evidence that material performance claims have been reviewed for accuracy?'],
  ]),
  ...gq('Credibility and final review', [
    ['GQ-26', 'Are material claims consistent with evidence and free from misleading language?'],
    ['GQ-27', 'Are adverse outcomes, incidents and underperformance disclosed alongside positive results?'],
    ['GQ-28', 'Are applicable reporting requirements addressed and gaps documented?'],
    ['GQ-29', 'Is the assurance status accurately described, including scope and limitations?'],
    ['GQ-30', 'Has the report undergone documented review and approval, with gaps and actions recorded?'],
  ]),
  ...mk('S1', [
    ['S1-01', 'Sustainability risks and opportunities identified', 'M-STD', 'critical', 'Has the entity identified sustainability-related risks and opportunities reasonably expected to affect its prospects over the short, medium or long term?', 'Risk and opportunity register; analysis'],
    ['S1-02', 'Identification process described', 'M-STD', 'high', 'Is the process for identifying those risks and opportunities described, including inputs and scope?', 'Process description; inputs'],
    ['S1-03', 'Materiality process', 'M-STD', 'critical', 'Is the materiality process explained and applied to information relevant to primary users’ decisions?', 'Materiality assessment and judgements'],
    ['S1-04', 'Same reporting entity', 'M-STD', 'critical', 'Are disclosures prepared for the same reporting entity as the related financial statements?', 'Group structure; boundary memo'],
    ['S1-05', 'Same reporting period', 'M-STD', 'high', 'Do disclosures cover the same reporting period as the related financial statements, subject to applicable reliefs?', 'Period dates; publication record'],
    ['S1-06', 'Location and relationship to financial reports', 'M-STD/M-REG', 'critical', 'Is the location and relationship of sustainability-related disclosures to general-purpose financial reports appropriate and explained?', 'Final annual report; contents page'],
    ['S1-07', 'Connected information', 'M-STD', 'high', 'Is information connected across sustainability disclosures and related financial statements, including relevant data and assumptions?', 'Cross-reference matrix; reconciliations'],
    ['S1-08', 'Complete, neutral, not obscured', 'M-STD/M-REG', 'critical', 'Are material sustainability-related risks and opportunities presented completely, neutrally and without obscuring important information?', 'Editorial review; materiality matrix'],
    ['S1-09', 'Governance processes and controls', 'M-STD', 'high', 'Are governance processes, controls and procedures for sustainability-related risks and opportunities disclosed?', 'Board/committee terms; minutes'],
    ['S1-10', 'Governance body and management roles', 'M-STD', 'high', 'Are the roles of the governance body and relevant management responsibilities disclosed?', 'RACI; delegations'],
    ['S1-11', 'Effect on strategy and decisions', 'M-STD', 'high', 'Does the report explain how sustainability-related risks and opportunities affect strategy and decision-making?', 'Strategy papers; decision records'],
    ['S1-12', 'Business model and value chain', 'M-STD', 'high', 'Are current and anticipated effects on the business model and value chain explained?', 'Value-chain map'],
    ['S1-13', 'Financial effects', 'M-STD', 'critical', 'Are current and anticipated financial effects on financial position, performance and cash flows disclosed as required?', 'Finance-reviewed estimates and assumptions'],
    ['S1-14', 'Time horizons', 'M-STD', 'medium', 'Are relevant short-, medium- and long-term horizons explained?', 'Horizon definitions'],
    ['S1-15', 'Resilience of strategy', 'M-STD/C-MAND', 'high', 'Is the resilience of strategy and the business model addressed where required?', 'Resilience analysis'],
    ['S1-16', 'Risk management processes', 'M-STD', 'high', 'Are processes for identifying, assessing, prioritising and monitoring sustainability-related risks and opportunities disclosed?', 'ERM framework; risk register'],
    ['S1-17', 'Integration into overall risk management', 'M-STD', 'high', 'Is the integration of those processes into overall risk management explained?', 'ERM policy'],
    ['S1-18', 'Metrics', 'M-STD', 'high', 'Are required metrics and the metrics used internally to monitor material matters disclosed?', 'Metric register; source data'],
    ['S1-19', 'Targets and progress', 'M-STD/C-MAND', 'high', 'Are entity-set or legally required targets disclosed, including progress where applicable?', 'Target register; performance data'],
    ['S1-20', 'Sources, methods and estimation uncertainty', 'M-STD', 'high', 'Are sources, methods, assumptions, changes, comparative information and relevant estimation uncertainty explained sufficiently?', 'Methodology notes; judgement and change log'],
  ]),
  ...mk('S2', [
    ['S2-01', 'Climate risks and opportunities identified', 'M-STD', 'critical', 'Has the entity identified climate-related risks and opportunities reasonably expected to affect its prospects?', 'Climate risk register'],
    ['S2-02', 'Climate governance', 'M-STD', 'high', 'Are governance processes, controls and procedures for climate-related matters disclosed?', 'Board terms/minutes; climate RACI'],
    ['S2-03', 'Business model and value chain', 'M-STD', 'high', 'Are current and anticipated climate-related effects on the business model and value chain explained?', 'Value-chain map'],
    ['S2-04', 'Strategy and transition planning', 'M-STD/C-MAND', 'high', 'Are climate-related effects on strategy and decisions, including transition planning where relevant, explained?', 'Transition plan; strategy decisions'],
    ['S2-05', 'Climate financial effects', 'M-STD', 'critical', 'Are current and anticipated financial effects disclosed as required, with limitations or reliefs explained?', 'Finance analysis; assumptions'],
    ['S2-06', 'Climate resilience', 'M-STD', 'high', 'Is the resilience of strategy and the business model to climate-related changes and uncertainties disclosed?', 'Resilience assessment'],
    ['S2-07', 'Scenario analysis', 'M-STD/C-MAND', 'critical', 'Is climate scenario analysis used and described as required, including approach, assumptions and limitations?', 'Model description; scenario inputs; review record'],
    ['S2-08', 'Physical and transition risks', 'M-STD', 'high', 'Are physical and transition risks identified and assessed over relevant time horizons?', 'Risk assessment'],
    ['S2-09', 'Climate risk management integration', 'M-STD', 'high', 'Are climate-risk management processes described and integrated with overall risk management?', 'ERM policy; climate register'],
    ['S2-10', 'Scope 1 emissions', 'M-STD/C-MAND', 'critical', 'Are Scope 1 greenhouse gas emissions disclosed where required, with boundary, methodology, factors and assumptions?', 'Activity data; calculations; factors'],
    ['S2-11', 'Scope 2 emissions', 'M-STD/C-MAND', 'critical', 'Are Scope 2 emissions disclosed where required, including location-based emissions and relevant contractual instruments?', 'Utility data; factors; contractual instruments'],
    ['S2-12', 'Scope 3 emissions', 'M-STD/C-MAND', 'high', 'Are relevant Scope 3 categories assessed and disclosed, with exclusions and estimates explained?', 'Value-chain inventory; category mapping'],
    ['S2-13', 'GHG measurement approach', 'M-STD/M-REG', 'critical', 'Are greenhouse gas measurement approaches, inputs, assumptions and emission factors documented?', 'GHG methodology; factor sources'],
    ['S2-14', 'Group and investee emissions', 'M-REG/C-MAND', 'high', 'Are group and investee emissions appropriately distinguished where applicable?', 'Consolidation map; investee schedule'],
    ['S2-15', 'Cross-industry climate metrics', 'M-STD/C-MAND', 'high', 'Are relevant cross-industry climate metrics disclosed, including applicable risk, capital deployment or carbon-pricing metrics?', 'Metric register'],
    ['S2-16', 'Industry-based metrics', 'M-STD/C-MAND', 'high', 'Are relevant industry-based metrics considered, with the selection and sources explained?', 'Industry mapping; metric sources'],
    ['S2-17', 'Climate targets', 'M-STD/C-MAND', 'high', 'Are climate targets disclosed with metric, scope, baseline, milestones, progress and changes where applicable?', 'Approved targets; baseline'],
    ['S2-18', 'Internal carbon price', 'M-REG/C-MAND', 'high', 'Is internal carbon pricing disclosed where applicable, including how it informs decisions?', 'Carbon price policy; decision-use evidence'],
    ['S2-19', 'Climate-related remuneration', 'C-MAND', 'medium', 'Are climate-related remuneration considerations disclosed where required and applicable?', 'Remuneration policy; committee minutes'],
    ['S2-20', 'Versions, reliefs and unavailable data', 'C-MAND', 'high', 'Are applicable standard versions, transition reliefs, measurement changes and reasons for unavailable data documented?', 'Standards register; relief memo'],
    ['S2-21', 'Financed emissions', 'C-MAND', 'high', 'Are Category 15 / financed emissions assessed and disclosed for relevant asset management, banking or insurance activities?', 'Portfolio exposure data; methodology'],
  ], { 'S2-21': financed }),
  ...mk('SEC', [
    ['SEC-01', 'Governance plan and Board oversight', 'M-REG', 'high', 'Is a sustainability-reporting governance plan documented, including Board oversight?', 'Board/committee terms; responsibility matrix'],
    ['SEC-02', 'IFRS S1/S2 gap assessment', 'M-REG', 'high', 'Has a gap assessment against IFRS S1 and IFRS S2 been completed and approved?', 'Gap analysis; approval'],
    ['SEC-03', 'Roadmap and timelines', 'M-REG', 'high', 'Is there an implementation roadmap with owners, milestones, timelines and dependencies?', 'Workplan; owners; dependencies'],
    ['SEC-04', 'Data and reporting systems', 'M-REG', 'high', 'Are data collection, reporting systems and data ownership arrangements planned?', 'Data inventory; system and ownership map'],
    ['SEC-05', 'Controls and assurance', 'M-REG', 'high', 'Are internal control and assurance arrangements addressed, including internal controls over sustainability reporting where relevant?', 'ICSR matrix; assurance approach'],
    ['SEC-06', 'Capacity building', 'M-REG', 'high', 'Is a capacity-building and training plan defined for Board, management, preparers and reviewers?', 'Training needs; schedule'],
    ['SEC-07', 'First reporting year', 'M-REG', 'high', 'Is the expected first reporting year identified consistently with the applicable FRCN roadmap?', 'Entity classification; phase memo'],
    ['SEC-08', 'Implementation challenges', 'M-REG', 'high', 'Are anticipated implementation challenges, dependencies and mitigations documented?', 'Risk/dependency register; mitigations'],
  ]),
  ...mk('FRC', [
    ['FRC-01', 'Stage 1 package', 'M-REG/C-MAND', 'high', 'Board adoption resolution, gap analysis and implementation plan submitted three months before the beginning of the reporting period.', 'Resolution; gap analysis; plan'],
    ['FRC-02', 'Disclosure policies and Board approval', 'M-REG/C-MAND', 'high', 'Approved sustainability disclosure policies (Stage 2, within three months of the period start).', 'Approved policy; minutes'],
    ['FRC-03', 'Materiality and governance structure', 'M-REG/C-MAND', 'high', 'Materiality assessment, transitional reliefs and governance structure evidence (Stage 2).', 'Assessment; reliefs; committee map'],
    ['FRC-04', 'Regulatory training', 'M-REG/C-MAND', 'high', 'Regulatory sustainability training for Board, management and preparers by a provider with an FRC MOU (Stage 2).', 'Attendance; provider; records'],
    ['FRC-05', 'Registration and signatory', 'M-REG/C-MAND', 'high', 'Entity and professionals registered with the FRC; signatory appends FRC number (Stage 3).', 'Registration evidence; signatory record'],
    ['FRC-06', 'Risk framework and approval', 'M-REG/C-MAND', 'high', 'Enterprise and sustainability risk management framework with Board approval (Stage 3).', 'Framework; Board minutes'],
    ['FRC-07', 'Metrics and targets approval', 'M-REG/C-MAND', 'high', 'Cross-industry and industry metrics and targets register with Board approval (Stage 3).', 'Register; minutes'],
    ['FRC-08', 'Current financial effects', 'M-REG/C-MAND', 'high', 'Current financial effects of sustainability-related risks and opportunities (Stage 3).', 'Finance analysis; assumptions'],
    ['FRC-09', 'ICSR', 'M-REG/C-MAND', 'critical', 'Internal control over sustainability reporting: ownership, methods, assumptions review, validation, reconciliation, audit trail and retention (Stage 3; distinct from ICFR).', 'ICSR matrix; sample tests; exceptions'],
    ['FRC-10', 'Report location and compliance statement', 'M-REG/C-MAND', 'critical', 'Identifiable section immediately after the Directors’ Report and before the financial statements, with a statement of compliance.', 'Final annual report; contents'],
    ['FRC-11', 'Internal carbon price jurisdiction', 'M-REG/C-MAND', 'high', 'Internal carbon price disclosed with the chosen jurisdiction and rationale where no Nigerian mechanism exists.', 'Price methodology'],
    ['FRC-12', 'GHG method and disaggregation', 'M-REG/C-MAND', 'high', 'GHG methodology, group/investee split, location-based Scope 2 and Scope 3 categories (financed emissions where relevant).', 'GHG method; schedules'],
  ]),
  ...mk('MOFI', [
    ['MOFI-01', 'Board structure and effectiveness', 'M-GOV/GP', 'high', 'Is there evidence of Board composition, roles, committee mandates, conflict handling and performance review?', 'Board register; charters; minutes; evaluation'],
    ['MOFI-02', 'Transparency and disclosure', 'M-GOV/GP', 'high', 'Are financial and non-financial disclosures timely, complete, approved and accessible?', 'Annual report; audited accounts; disclosure log'],
    ['MOFI-03', 'ESG and sustainability practices', 'M-GOV/GP', 'high', 'Are ESG responsibilities, policies, risk integration, indicators and improvement actions evidenced?', 'ESG framework; metrics; Board approval'],
    ['MOFI-04', 'Stakeholder and shareholder engagement', 'M-GOV/GP', 'high', 'Are engagement channels, concerns, responses and escalation processes documented?', 'Engagement plan; AGM records; grievance log'],
    ['MOFI-05', 'Risk management and internal controls', 'M-GOV/GP', 'high', 'Is there an approved risk framework, risk register, control ownership, testing and remediation tracking?', 'ERM framework; register; control matrix'],
    ['MOFI-06', 'Ethics', 'M-GOV/GP', 'high', 'Are codes of conduct, conflict declarations, whistleblowing channels and investigation protocols implemented?', 'Code; declarations; case log'],
    ['MOFI-07', 'Anti-corruption', 'M-GOV/GP', 'high', 'Are anti-bribery controls, due diligence, gifts/hospitality controls, training and incident responses evidenced?', 'Policy; due diligence; training; incidents'],
    ['MOFI-08', 'Internal audit function', 'M-GOV/GP', 'high', 'Is internal audit appropriately mandated and resourced, with risk-based plans, reporting and follow-up?', 'Charter; plan; reports; tracker'],
    ['MOFI-09', 'IT infrastructure and digital governance', 'M-GOV/GP', 'high', 'Are access controls, cybersecurity, data governance, resilience and incident response evidenced?', 'IT policy; access reviews; incident log'],
  ]),
  ...mk('EC', [
    ['EC-01', 'Claims traceable to accepted evidence', 'CRAFT', 'high', 'Every material reported claim and figure is linked to evidence that a reviewer has accepted.', 'Evidence register with review decisions'],
    ['EC-02', 'Reviewer decisions recorded', 'CRAFT', 'high', 'Reviewer decisions, rationale and dates are recorded for all evidence supporting critical and high checks.', 'Review log'],
    ['EC-03', 'Exceptions authorised', 'CRAFT', 'high', 'Every exception or override is authorised, documented and auditable, and none waives a legal obligation.', 'Exception register with approvals'],
    ['EC-04', 'Audit trail retained', 'CRAFT', 'medium', 'Material changes to statuses, evidence, scores and sign-off are retained in the audit trail.', 'Audit log extract'],
  ]),
  ...mk('JUR', [
    ['JUR-01', 'Jurisdictional adoption basis recorded', 'M-REG', 'high', 'Record the national adoption instrument, entity category, first mandatory period and any phase or modification that applies.', 'Classification memo; copy of the pronouncement or roadmap'],
    ['KE-01', 'ICPAK readiness assessment', 'M-REG', 'high', 'Sustainability Reporting Readiness Assessment (governance, strategy, risk management, metrics and targets) submitted to ICPAK six months before the first mandatory period.', 'Submitted assessment; acknowledgement'],
    ['RW-01', 'RSE ESG Guidelines (initial phase)', 'M-REG', 'high', 'Listed entity reports under the Rwanda Stock Exchange ESG Guidelines during the initial phase.', 'ESG report; RSE filing'],
    ['RW-02', 'Simplified climate-only scope', 'M-REG', 'high', 'Climate-only ISSB scope applied correctly, including the jurisdictional modifications for the phase.', 'Phase classification; scope memo'],
    ['ZW-01', 'Transition reliefs and full-compliance date', 'M-REG', 'high', 'Category, reliefs used and the date full ISSB compliance is required are recorded.', 'Category memo; relief register'],
    ['GH-01', 'ICAG category and sector classification', 'M-REG', 'high', 'Significant PIE, high-impact sector or other mandatory adopter classification documented.', 'Classification memo'],
    ['NG-01', 'FRC readiness test', 'M-REG', 'high', 'Entity has passed through the FRC Readiness Test Assessment before adopting.', 'FRC correspondence; readiness submission'],
    ['JUR-02', 'Exchange or regulator sustainability-disclosure rules', 'C-MAND', 'high', 'The exchange or regulator sustainability-disclosure rules or guidance for listed issuers have been identified, their status (mandatory, comply-or-explain or voluntary) confirmed with the source, and applied in the report.', 'Copy of the rule or guidance; status confirmation; index mapping disclosures to it'],
  ], {
    'JUR-02': { condition: (p) => p.category.endsWith('_listed') && !!countryByIso(p.jurisdiction)?.esgDisclosure, conditionNote: 'Applies to listed issuers where the exchange or regulator has sustainability-disclosure rules or guidance.' },
    'KE-01': { condition: (p, a) => p.jurisdiction === 'KE' && a.status === 'mandatory' && p.category === 'ke_pie' },
    'RW-01': { condition: (p, a) => p.jurisdiction === 'RW' && a.scope === 'exchange_esg_guidelines' },
    'RW-02': { condition: (p, a) => p.jurisdiction === 'RW' && a.scope === 'climate_only' },
    'ZW-01': { condition: (p, a) => p.jurisdiction === 'ZW' && a.status === 'mandatory' },
    'GH-01': { condition: (p, a) => p.jurisdiction === 'GH' && a.status === 'mandatory' },
    'NG-01': { condition: (p, a) => p.jurisdiction === 'NG' && (a.status === 'mandatory' || a.status === 'voluntary') },
  }),
]

export const checkById = (id: string) => CHECKS.find((c) => c.id === id) ?? null
const isMandatoryClass = (c: ReqClass) => c.startsWith('M-')

// Which checks apply, with the class effective for this entity and period.
export interface ApplicableCheck { check: Check; mandatory: boolean; label: string; reason: string }
export function applicableChecks(profile: QaProfile, periodStart: string): { applicability: Applicability; checks: ApplicableCheck[] } {
  const a = ifrsApplicability(profile, periodStart)
  const reporting = a.status === 'mandatory' || a.status === 'voluntary'
  const out: ApplicableCheck[] = []
  for (const c of CHECKS) {
    if (c.condition && !c.condition(profile, a)) continue
    let mandatory = c.classes.some(isMandatoryClass) && a.status === 'mandatory'
    let reason = ''
    switch (c.pack) {
      case 'GQ':
        reason = 'CRAFT general quality baseline (approved 12 October 2026).'
        break
      case 'EC':
        reason = 'CRAFT evidence and control rule.'
        break
      case 'S1':
        if (!reporting || a.scope === 'exchange_esg_guidelines') continue
        if (a.scope === 'climate_only') { reason = 'Applies only to the extent needed to apply IFRS S2 (climate-only phase).'; mandatory = false }
        else reason = a.status === 'mandatory' ? `IFRS S1 mandatory from ${a.effectiveFrom}.` : 'Voluntary IFRS S1 adoption.'
        break
      case 'S2':
        if (!reporting || a.scope === 'exchange_esg_guidelines') continue
        reason = a.status === 'mandatory' ? `IFRS S2 mandatory from ${a.effectiveFrom}.` : 'Voluntary IFRS S2 adoption.'
        break
      case 'SEC':
        if (profile.jurisdiction !== 'NG' || !profile.secScope) continue
        mandatory = true; reason = 'SEC circular of 23 September 2026 (plan due 15 October 2026).'
        break
      case 'FRC':
        if (profile.jurisdiction !== 'NG' || !reporting) continue
        reason = 'FRCN SRG 1 (2026) readiness and reporting requirements.'
        break
      case 'MOFI':
        if (profile.jurisdiction !== 'NG' || !(profile.mofiScope || profile.mofiOverlay)) continue
        mandatory = profile.mofiScope
        reason = profile.mofiScope ? 'Entity is in MOFI scope.' : 'Optional MOFI-aligned benchmark (good practice, not mandatory).'
        break
      case 'JUR':
        if (c.id === 'JUR-01') { if (!reporting) continue; mandatory = a.status === 'mandatory' }
        else if (c.id === 'JUR-02') { mandatory = false; reason = `${countryByIso(profile.jurisdiction)?.esgDisclosure}.`; break }
        else mandatory = a.status === 'mandatory'
        reason = c.conditionNote ?? jurisdictionByCode(profile.jurisdiction)?.sourceTitle ?? ''
        break
      default: continue
    }
    if (c.condition && c.conditionNote) reason = `${reason} ${c.conditionNote}`.trim()
    const label = mandatory ? CLASS_LABELS[c.classes.find(isMandatoryClass) ?? 'M-STD']
      : c.classes.includes('CRAFT') ? CLASS_LABELS.CRAFT
      : c.classes.includes('GP') || c.pack === 'MOFI' ? `${CLASS_LABELS.GP}${c.pack === 'MOFI' ? ' / MOFI-aligned' : ''}`
      : c.classes.includes('C-MAND') ? 'Conditional — confirm the trigger applies' : 'Applicable (not mandatory)'
    out.push({ check: c, mandatory, label, reason })
  }
  return { applicability: a, checks: out }
}

// --- Scoring and readiness gates ---------------------------------------------------------------
export type CheckStatus = 'not_started' | 'in_progress' | 'met' | 'partially_met' | 'not_met' | 'blocked' | 'not_applicable'
  | 'pending_review' | 'returned' | 'exception_approved'
export const STATUS_LABELS: Record<CheckStatus, string> = {
  not_started: 'Not started', in_progress: 'In progress', met: 'Met', partially_met: 'Partially met', not_met: 'Not met', blocked: 'Blocked',
  not_applicable: 'N/A (needs approval)', pending_review: 'Pending review', returned: 'Returned for more evidence', exception_approved: 'Exception approved',
}
// Statuses that record a final assessment (coverage). Pending/returned/in-progress are not final.
const FINAL: CheckStatus[] = ['met', 'partially_met', 'not_met', 'blocked', 'exception_approved']
export type EvidenceState = 'none' | 'pending' | 'accepted' | 'rejected'
export const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 5, high: 3, medium: 2, low: 1 }

export interface CheckInstance {
  checkId: string
  status: CheckStatus
  evidence: EvidenceState
  naApproved: boolean
}

export const BANDS = [
  { min: 90, label: 'Strong evidence profile' }, { min: 75, label: 'Generally sound' }, { min: 60, label: 'Needs improvement' },
  { min: 40, label: 'Weak' }, { min: 0, label: 'High improvement need' },
] as const

// Weights approved by the product owner on 12 October 2026: Critical 5, High 3, Medium 2, Low 1; good practice 1.
export const checkWeight = (c: Check) => (c.classes.length === 1 && c.classes[0] === 'GP' ? 1 : SEVERITY_WEIGHT[c.severity])

const ratio = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)

export function scoreChecklist(applicable: ApplicableCheck[], instances: CheckInstance[], signedOff: boolean) {
  const byId = new Map(instances.map((i) => [i.checkId, i]))
  let earned = 0, possible = 0, assessed = 0, needEvidence = 0, accepted = 0, mand = 0, mandAssessed = 0, mandMet = 0
  const criticalOpen: string[] = [], mandatoryUnresolved: string[] = [], pendingNa: string[] = [], unreviewedEvidence: string[] = []
  for (const { check, mandatory } of applicable) {
    const i = byId.get(check.id) ?? { checkId: check.id, status: 'not_started' as CheckStatus, evidence: 'none' as EvidenceState, naApproved: false }
    if (i.status === 'not_applicable' && i.naApproved) continue // excluded only after approval
    if (i.status === 'not_applicable') pendingNa.push(check.id)
    if (i.evidence === 'pending' || i.status === 'pending_review') unreviewedEvidence.push(check.id)
    const w = checkWeight(check)
    possible += w
    needEvidence++
    if (i.evidence === 'accepted') accepted++
    // No points before evidence acceptance: Met / Partially met count only with accepted evidence.
    const met = i.status === 'met' && i.evidence === 'accepted'
    if (met) earned += w
    else if (i.status === 'partially_met' && i.evidence === 'accepted') earned += 0.5 * w
    // Exception approved earns no points and never clears a mandatory or critical check.
    if (FINAL.includes(i.status)) assessed++
    if (mandatory) {
      mand++
      if (FINAL.includes(i.status)) mandAssessed++
      if (met) mandMet++
      else mandatoryUnresolved.push(check.id)
    }
    if (check.severity === 'critical' && !met) criticalOpen.push(check.id)
  }
  const score = possible ? Math.round((earned / possible) * 1000) / 10 : 0
  const blockers = [
    ...(criticalOpen.length ? [`${criticalOpen.length} open critical check(s)`] : []),
    ...(mandatoryUnresolved.length ? [`${mandatoryUnresolved.length} unresolved mandatory requirement(s)`] : []),
    ...(pendingNa.length ? [`${pendingNa.length} not-applicable decision(s) awaiting approval`] : []),
    ...(unreviewedEvidence.length ? [`${unreviewedEvidence.length} check(s) with unreviewed evidence`] : []),
    ...(!signedOff ? ['Final sign-off not recorded'] : []),
  ]
  return {
    version: CHECKLIST_VERSION,
    score,
    band: BANDS.find((b) => score >= b.min)!.label,
    coverage: ratio(assessed, needEvidence),
    evidenceAcceptance: ratio(accepted, needEvidence),
    mandatoryCoverage: ratio(mandAssessed, mand),
    mandatoryPassRate: ratio(mandMet, mand),
    applicable: needEvidence,
    criticalOpen, mandatoryUnresolved, pendingNa, unreviewedEvidence,
    // The gate overrides the score: never "ready" with any blocker, whatever the number.
    readyForApproval: blockers.length === 0,
    blockers,
  }
}

export const LEGACY_CHECKS_STATUS = {
  imported: 30,
  expected: 30,
  reconciled: true,
  approvedOn: '2026-10-12',
  note: 'The 30 general quality checks (GQ-01–GQ-30) were approved by the product owner on 12 October 2026 as the canonical CRAFT baseline, together with the 5/3/2/1 weights and score labels.',
}
