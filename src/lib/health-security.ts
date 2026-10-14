// Health-security assessments for national public health institutes (NPHIs):
//  • NPHI — CRAFT-NPHI 1.0, built on the Africa CDC NPHI Development Framework 2.0 (April 2024)
//    and the first-edition framework (key attributes, core functions, capacity building,
//    establishment steps, regional Centre of Excellence criteria). CRAFT's own maturity rubric:
//    not the Africa CDC NPHI Scorecard or the IANPHI/US CDC Staged Development Tool.
//  • JEE — WHO Joint External Evaluation tool, 3rd edition (2022): 19 technical areas, levels 1–5.
//  • SPAR — WHO IHR States Parties Self-Assessment Annual Reporting tool, 2nd edition (2021):
//    15 capacities, 35 indicators, levels 1–5; indicator % = level/5×100, capacity = mean of its
//    indicators, overall = mean of capacities (the SPAR average is SDG indicator 3.d.1).
//  • JEE_SUB — subnational (state, county, provincial) JEE-style self-assessment: CRAFT's adaptation
//    of the JEE 3rd-edition areas for subnational governments, as done with adapted JEE tools for
//    states (e.g. NCDC Nigeria). Areas that are a national competence are marked not applicable.
//  • AAR and SIMEX — after-action reviews and simulation exercises, the other two components of
//    the WHO IHR Monitoring and Evaluation Framework; recorded as findings against JEE areas.
// Availability: national public health institutes get all types; subnational governments get the
// subnational JEE, after-action reviews and simulation exercises.
// Self-check: `node src/lib/health-security.test.ts`.

export const HEALTH_SECURITY_TYPES = ['NPHI', 'JEE', 'JEE_SUB', 'SPAR', 'AAR', 'SIMEX'] as const
export type HealthSecurityType = (typeof HEALTH_SECURITY_TYPES)[number]
export const isHealthSecurityType = (t: string): t is HealthSecurityType => (HEALTH_SECURITY_TYPES as readonly string[]).includes(t)
export const HEALTH_SECURITY_LABELS: Record<HealthSecurityType, string> = {
  NPHI: 'NPHI development assessment (Africa CDC framework)', JEE: 'Joint External Evaluation (WHO JEE 3rd ed.)', JEE_SUB: 'Subnational JEE-style self-assessment',
  SPAR: 'IHR SPAR self-assessment (WHO 2nd ed.)', AAR: 'After-action review', SIMEX: 'Simulation exercise',
}
export const ORG_TYPE_HEALTH_SECURITY: Record<string, HealthSecurityType[]> = {
  nphi: [...HEALTH_SECURITY_TYPES],
  subnational: ['JEE_SUB', 'AAR', 'SIMEX'],
}
export const healthSecurityTypesFor = (orgType: string): HealthSecurityType[] => ORG_TYPE_HEALTH_SECURITY[orgType] ?? []

export interface CatalogueItem { id: string; sectionId: string; name: string; description: string; critical?: boolean; extended?: boolean }
export interface CatalogueSection { id: string; name: string; intro: string; extended?: boolean }
export interface Catalogue {
  id: 'NPHI' | 'JEE' | 'JEE_SUB' | 'SPAR' | 'PSP'
  title: string
  version: string
  source: { title: string; url: string }
  levels: string[] // index 0 = level 1
  evidenceCap: number | null // score counted at most this without evidence
  unansweredScoresZero?: boolean // WHO SPAR rule: an indicator with no level selected counts as 0
  extendedScopeLabel?: string
  sections: CatalogueSection[]
  items: CatalogueItem[]
  disclaimer: string
}

const sec = (id: string, name: string, intro: string, extended?: boolean): CatalogueSection => ({ id, name, intro, extended })
const it = (sectionId: string, rows: [string, string, string, boolean?][], extended?: boolean): CatalogueItem[] =>
  rows.map(([id, name, description, critical]) => ({ id, sectionId, name, description, critical, extended }))

// --- NPHI development (Africa CDC framework) ----------------------------------------------------
export const NPHI: Catalogue = {
  id: 'NPHI', title: 'NPHI development assessment', version: 'CRAFT-NPHI 1.0 (2026-10-14)',
  source: { title: 'Africa CDC — National Public Health Institutes in Africa: Development Framework 2.0 (April 2024)', url: 'https://africacdc.org/download/national-public-health-institutes-in-africa-development-framework-2-0/' },
  levels: ['1 — Absent', '2 — Initial / ad hoc', '3 — Defined', '4 — Implemented and resourced', '5 — Embedded, reviewed and improving'],
  evidenceCap: 2,
  extendedScopeLabel: 'Assess readiness to serve as a regional NPHI Centre of Excellence',
  sections: [
    sec('attributes', 'Key attributes', 'Internal-facing management and functioning of the institute.'),
    sec('functions', 'Core functions', 'The ten core public health functions. Critical functions define NPHI functionality.'),
    sec('capacity', 'Capacity building', 'Institutional capacity components from framework 2.0 §2.2.'),
    sec('establishment', 'Establishment and governance', 'Stepwise establishment, legal framework and governance structure.'),
    sec('coe', 'Centre of Excellence readiness', 'Criteria for designation as a regional NPHI Centre of Excellence (§3.1).', true),
  ],
  items: [
    ...it('attributes', [
      ['A1', 'Science-based', 'Data and evidence drive recommendations, programmes and policy advice to the Ministry of Health.'],
      ['A2', 'National scope', 'Serves the entire national population, not selected communities or a single city or province.'],
      ['A3', 'Transparent and accountable', 'Manages and accounts for resources using good business practice; open to evaluation of its performance.'],
      ['A4', 'Strong, continuously improving workforce', 'Strategies for individual growth, retention and career paths.'],
      ['A5', 'Adequate infrastructure', 'Laboratory, communications, IT and resource-mobilisation infrastructure to perform the core functions.'],
      ['A6', 'Clearly defined legal authority', 'Legislation or decree describing mandate, functions and authority, including cross-agency (One Health, all-hazards) and emergency powers.'],
      ['A7', 'Linkages at all levels', 'Effective links with the Ministry of Health, subnational public health, Africa CDC and its Regional Coordinating Centre, and IHR/GHSA partners.'],
      ['A8', 'Plans for sustainability', 'Government appropriation, partner support, research funding and foundations; dedicated national budget line.'],
    ]),
    ...it('functions', [
      ['CF1', 'Population health and health-related indicators', 'Health observatory, dashboards and reports on mortality, morbidity, disability and sub-population health used for policy.'],
      ['CF2', 'Laboratory, surveillance, and emergency preparedness and response', 'All-hazards / One Health surveillance, laboratory confirmation at each level, EOCs, outbreak detection and response, IHR focal point role.', true],
      ['CF3', 'Disease prevention and health promotion', 'Evidence-based vaccination, screening and multi-faceted health promotion.'],
      ['CF4', 'Advocacy, communication and social mobilisation', 'Materials for civil society, audience-targeted messaging and coalitions.'],
      ['CF5', 'Policies and plans that support public health', 'Strategic approaches to priority issues, evidence synthesis and uptake of evidence-based practice.'],
      ['CF6', 'Health protection, regulation and enforcement support', 'Risk assessment for environmental, occupational and food safety; drafting and advising on laws and regulations.'],
      ['CF7', 'Evaluation and promotion of equitable access to services', 'Barriers to access and preventive needs of underserved populations identified and acted on.'],
      ['CF8', 'Public health workforce development', 'FETP, university partnerships, pipeline and core competencies at all levels.', true],
      ['CF9', 'Public health issues in clinical settings', 'Surveillance of healthcare-associated infections and antimicrobial resistance; preventive care with clinical networks.'],
      ['CF10', 'Research in public health', 'National research agenda, operational research and use of results for policy and programmes.', true],
    ]),
    ...it('capacity', [
      ['CB1', 'Business case and stakeholder buy-in', 'Business case with return on investment; change management for affected staff and units.'],
      ['CB2', 'Workspace and facilities', 'Safe, accessible workspace that supports collaboration across units.'],
      ['CB3', 'Public health emergency operations centre (PHEOC)', 'Equipped PHEOC with trained staff, communications, funding, SOPs and plans; network with other PHEOCs and Africa CDC.'],
      ['CB4', 'Public health laboratory network', 'National public health laboratory network with policy, governance and regulatory capacity; interoperable laboratory information system; RISLNET links.'],
      ['CB5', 'Workforce development system', 'Workforce strategy, national database of public health workers, FETP, CPD and HR autonomy.'],
      ['CB6', 'Medical countermeasures', 'System to procure and deploy vaccines, drugs, diagnostics and devices for emergencies.'],
      ['CB7', 'Logistics and supply chain', 'Forecasting, gap analysis, storage, stock management and delivery, including customs procedures.'],
      ['CB8', 'Health information management and IT', 'Interoperable HIS, LIMS, connectivity, data security and privacy, backup and recovery, observatory and GIS.'],
      ['CB9', 'Institutional policies and procedures', 'HR, finance, procurement, risk, quality and technical SOPs, regularly reviewed; knowledge management.'],
      ['CB10', 'Monitoring, evaluation, accountability and learning', 'MEAL integrated in management; performance management; use of the Africa CDC NPHI Scorecard or Staged Development Tool.'],
      ['CB11', 'Collaboration and partnerships', 'One Health collaboration, MoH strategic oversight, alliances with agencies, donors, academia and communities.'],
      ['CB12', 'Sustainability and financing', 'Multi-year strategic plan, dedicated treasury funding, innovative financing (testing, training), foundation.'],
      ['CB13', 'Risk register and threats to success', 'Risk register covering partner-funding dependence, leadership and political change, staff attrition and emergency contingency funds.'],
    ]),
    ...it('establishment', [
      ['E1', 'Leadership commitment and champion', 'Government commitment, a high-level champion and dedicated leadership for the process.'],
      ['E2', 'Stakeholder engagement', 'Early, expanding engagement of affected groups and partners; shared vision.'],
      ['E3', 'Technical working group', 'Multisectoral, multidisciplinary TWG coordinating NPHI formation under MoH leadership.'],
      ['E4', 'Needs and core functions defined', 'Justification, scope, benefits, costs and the core functions to include.'],
      ['E5', 'Roadmap', 'Actions, resources, stakeholders and timeline for establishment.'],
      ['E6', 'Existing functions mapped', 'Public health functions across institutions mapped; single entity or network decision made.'],
      ['E7', 'Strategic plan', 'Vision, mission, goals, KPIs and alignment with health sector plans.'],
      ['E8', 'Resources mobilised', 'Start-up and long-term resources identified, gaps addressed, leadership succession planned.'],
      ['E9', 'Legal framework', 'Act, decree or equivalent establishing the NPHI with mandate, powers, operational and technical independence.', true],
      ['E10', 'Governance structure', 'Defined relationship to the Minister of Health (line agency or parastatal with a board); reporting lines.'],
      ['E11', 'Inauguration', 'Public launch informing stakeholders of the NPHI’s role.'],
    ]),
    ...it('coe', [
      ['COE1', 'Demonstrated expertise', 'Excellence in at least one of surveillance, emergency preparedness and response, laboratory systems, information systems, research or workforce development.'],
      ['COE2', 'Leadership and governance', 'Experienced leadership, clear decision-making and transparent accountability.'],
      ['COE3', 'Location and population served', 'Strategic location serving a significant regional population and its health needs.'],
      ['COE4', 'Human resources and surge capacity', 'Sufficient trained staff for regional operations with a surge mechanism.'],
      ['COE5', 'Technical capability', 'Access to current research, innovative methods and best practice in the specialist area.'],
      ['COE6', 'Infrastructure', 'Modern, maintained laboratory, data and communication infrastructure linked to the PHEOC.'],
      ['COE7', 'Collaborative partnerships', 'Partnerships with other NPHIs, academia, government, NGOs and international partners.'],
      ['COE8', 'Capacity building track record', 'Training, mentorship and technical assistance delivered in the region.'],
      ['COE9', 'Evidence of impact', 'Demonstrable regional public health impact.'],
      ['COE10', 'Continuous improvement', 'Regular performance evaluation, stakeholder feedback and adaptation.'],
    ], true),
  ],
  disclaimer: 'CRAFT-NPHI uses CRAFT’s maturity rubric applied to the Africa CDC framework. It is not the Africa CDC NPHI Scorecard, the IANPHI/US CDC Staged Development Tool or an Africa CDC designation.',
}

// --- JEE 3rd edition -------------------------------------------------------------------------
export const JEE: Catalogue = {
  id: 'JEE', title: 'Joint External Evaluation (JEE) — self-assessment or mission record', version: 'WHO JEE tool, 3rd edition (2022)',
  source: { title: 'WHO — Joint external evaluation tool: International Health Regulations (2005), third edition', url: 'https://www.who.int/publications/i/item/9789240051980' },
  levels: ['1 — No capacity', '2 — Limited capacity', '3 — Developed capacity', '4 — Demonstrated capacity', '5 — Sustainable capacity'],
  evidenceCap: null,
  sections: [sec('prevent', 'Prevent', 'P1–P8'), sec('detect', 'Detect', 'D1–D3'), sec('respond', 'Respond', 'R1–R5'), sec('other', 'IHR-related hazards and points of entry', 'PoE, CE, RE')],
  items: [
    ...it('prevent', [
      ['P1', 'Legal instruments', 'Legislation, policies and administrative arrangements to implement the IHR, including gender equity in emergencies.'],
      ['P2', 'Financing', 'Financing for IHR implementation and for public health emergency response.'],
      ['P3', 'IHR coordination, National IHR Focal Point functions and advocacy', 'Multisectoral coordination, NFP functions and advocacy (includes former reporting area).'],
      ['P4', 'Antimicrobial resistance (AMR)', 'Multisectoral AMR coordination, surveillance, prevention and stewardship.'],
      ['P5', 'Zoonotic disease', 'One Health surveillance and response to zoonoses.'],
      ['P6', 'Food safety', 'Surveillance and response to food safety events.'],
      ['P7', 'Biosafety and biosecurity', 'Whole-of-government biosafety and biosecurity systems and training.'],
      ['P8', 'Immunization', 'Vaccine coverage and delivery, including in emergencies.'],
    ]),
    ...it('detect', [
      ['D1', 'National laboratory system', 'Specimen referral, quality systems, testing capacity and diagnostic network.'],
      ['D2', 'Surveillance', 'Early warning surveillance and event management.'],
      ['D3', 'Human resources', 'Multisectoral workforce strategy, workforce for IHR, surge capacity and FETP.'],
    ]),
    ...it('respond', [
      ['R1', 'Health emergency management', 'Risk assessment, planning, PHEOC, management of response, logistics and supply chain, research during emergencies.'],
      ['R2', 'Linking public health and security authorities', 'Public health and security authorities linked during suspected or confirmed biological, chemical or radiological events.'],
      ['R3', 'Health services provision', 'Case management, utilisation of services and continuity of essential services.'],
      ['R4', 'Infection prevention and control', 'IPC programmes, healthcare-associated infection surveillance and safe environments.'],
      ['R5', 'Risk communication and community engagement', 'RCCE systems, risk communication, community engagement and infodemic management.'],
    ]),
    ...it('other', [
      ['PoE', 'Points of entry and border health', 'Core capacities at designated points of entry, public health response and travel measures.'],
      ['CE', 'Chemical events', 'Detection, alert and response to chemical events.'],
      ['RE', 'Radiation emergencies', 'Detection, alert and response to radiation emergencies.'],
    ]),
  ],
  disclaimer: 'Records JEE technical-area scores from a voluntary self-assessment or a WHO-led JEE mission. Only a mission report constitutes a Joint External Evaluation; record the mission report as evidence.',
}

// --- SPAR 2nd edition --------------------------------------------------------------------------
export const SPAR: Catalogue = {
  id: 'SPAR', title: 'IHR States Parties Self-Assessment Annual Report (SPAR)', version: 'WHO SPAR tool, 2nd edition (2021)',
  source: { title: 'WHO — IHR (2005) States Parties self-assessment annual reporting tool, second edition', url: 'https://www.who.int/publications/i/item/9789240040120' },
  levels: ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'],
  evidenceCap: null,
  unansweredScoresZero: true,
  sections: [
    sec('C1', 'C1 Policy, legal and normative instruments to implement IHR', ''), sec('C2', 'C2 IHR coordination and National IHR Focal Point', ''),
    sec('C3', 'C3 Financing', ''), sec('C4', 'C4 Laboratory', ''), sec('C5', 'C5 Surveillance', ''), sec('C6', 'C6 Human resources', ''),
    sec('C7', 'C7 Health emergency management', ''), sec('C8', 'C8 Health services provision', ''), sec('C9', 'C9 Infection prevention and control (IPC)', ''),
    sec('C10', 'C10 Risk communication and community engagement (RCCE)', ''), sec('C11', 'C11 Points of entry (PoEs) and border health', ''), sec('C12', 'C12 Zoonotic diseases', ''),
    sec('C13', 'C13 Food safety', ''), sec('C14', 'C14 Chemical events', ''), sec('C15', 'C15 Radiation emergencies', ''),
  ],
  items: [
    ...it('C1', [['C1.1', 'Policy, legal and normative instruments', ''], ['C1.2', 'Gender equality in health emergencies', '']]),
    ...it('C2', [['C2.1', 'National IHR Focal Point functions', ''], ['C2.2', 'Multisectoral coordination mechanisms', ''], ['C2.3', 'Advocacy for IHR implementation', '']]),
    ...it('C3', [['C3.1', 'Financing for IHR implementation', ''], ['C3.2', 'Financing for public health emergency response', '']]),
    ...it('C4', [['C4.1', 'Specimen referral and transport system', ''], ['C4.2', 'Implementation of a laboratory biosafety and biosecurity regime', ''], ['C4.3', 'Laboratory quality system', ''], ['C4.4', 'Laboratory testing capacity modalities', ''], ['C4.5', 'Effective national diagnostic network', '']]),
    ...it('C5', [['C5.1', 'Early warning surveillance function', ''], ['C5.2', 'Event management', '']]),
    ...it('C6', [['C6.1', 'Human resources for implementation of IHR', ''], ['C6.2', 'Workforce surge during a public health event', '']]),
    ...it('C7', [['C7.1', 'Planning for health emergencies', ''], ['C7.2', 'Management of health emergency response', ''], ['C7.3', 'Emergency logistic and supply chain management', '']]),
    ...it('C8', [['C8.1', 'Case management', ''], ['C8.2', 'Utilization of health services', ''], ['C8.3', 'Continuity of essential health services (EHS)', '']]),
    ...it('C9', [['C9.1', 'Infection prevention and control programmes', ''], ['C9.2', 'Health care-associated infections (HCAI) surveillance', ''], ['C9.3', 'Safe environment in health facilities', '']]),
    ...it('C10', [['C10.1', 'RCCE system for emergencies', ''], ['C10.2', 'Risk communication', ''], ['C10.3', 'Community engagement', '']]),
    ...it('C11', [['C11.1', 'Core capacity requirements at all times for PoEs (airports, ports and ground crossings)', ''], ['C11.2', 'Public health response at PoEs', ''], ['C11.3', 'Risk-based approach to international travel-related measures', '']]),
    ...it('C12', [['C12.1', 'One Health collaborative efforts across sectors on activities to address zoonoses', '']]),
    ...it('C13', [['C13.1', 'Multisectoral collaboration mechanism for food safety events', '']]),
    ...it('C14', [['C14.1', 'Resources for detection and alert', '']]),
    ...it('C15', [['C15.1', 'Capacity and resources', '']]),
  ],
  disclaimer: 'Prepares and tracks the SPAR self-assessment. Indicator names checked against the WHO tool (2nd ed., 2021) on 15 October 2026; the level summaries are CRAFT paraphrases with page references to WHO’s official wording. As in WHO’s method, an unanswered indicator counts as zero. The official report is submitted by the National IHR Focal Point through WHO e-SPAR.',
}

// --- Subnational JEE-style self-assessment ----------------------------------------------------
// JEE areas worded for the subnational level, plus three CRAFT additions (S1–S3). Areas led
// nationally (e.g. points of entry, radiation) are marked not applicable with a reason.
export const JEE_SUB: Catalogue = {
  id: 'JEE_SUB', title: 'Subnational JEE-style self-assessment (state, county or province)', version: 'CRAFT-SJEE 1.0 (2026-10-14), adapted from WHO JEE 3rd edition',
  source: JEE.source,
  levels: JEE.levels,
  evidenceCap: 2,
  sections: [...JEE.sections, sec('sub', 'Subnational arrangements', 'CRAFT additions for subnational governments.')],
  items: [
    ...JEE.items.map((i) => ({ ...i, description: `At subnational level: ${i.description.charAt(0).toLowerCase()}${i.description.slice(1)} Mark not applicable, with the reason, where this is a national competence.` })),
    ...it('sub', [
      ['S1', 'Subnational action plan for health security', 'Costed state, county or provincial action plan aligned with the national action plan (NAPHS), with progress tracked.'],
      ['S2', 'Links to the National IHR Focal Point and NPHI', 'Agreed reporting, alert and escalation channels to the National IHR Focal Point and the national public health institute.'],
      ['S3', 'Local government and district capacity', 'Surveillance focal persons, rapid response teams and funding at local government or district level.'],
    ]),
  ],
  disclaimer: 'CRAFT adaptation of the WHO JEE 3rd-edition technical areas for subnational self-assessment. It is not an official WHO tool or an NCDC State JEE; use the national authority’s adapted tool where one exists.',
}

export const CATALOGUES: Record<'NPHI' | 'JEE' | 'JEE_SUB' | 'SPAR', Catalogue> = { NPHI, JEE, JEE_SUB, SPAR }
export const catalogueFor = (t: string) => (t === 'NPHI' || t === 'JEE' || t === 'JEE_SUB' || t === 'SPAR' ? CATALOGUES[t] : null)
// After-action reviews and simulation exercises record findings against JEE technical areas.
export const REVIEW_DOMAINS = JEE.items.map((i) => ({ value: i.id, label: `${i.id} ${i.name}` }))

// --- Crosswalk ----------------------------------------------------------------------------------
// SPAR capacity ↔ JEE technical areas ↔ NPHI items. JEE-only areas are listed with spar: null.
export const CROSSWALK: { spar: string | null; jee: string[]; nphi: string[]; theme: string }[] = [
  { spar: 'C1', jee: ['P1'], nphi: ['A6', 'E9'], theme: 'Legal instruments' },
  { spar: 'C2', jee: ['P3'], nphi: ['A7'], theme: 'IHR coordination and focal point' },
  { spar: 'C3', jee: ['P2'], nphi: ['A8', 'CB12'], theme: 'Financing' },
  { spar: 'C4', jee: ['D1', 'P7'], nphi: ['CF2', 'CB4'], theme: 'Laboratory, biosafety and biosecurity' },
  { spar: 'C5', jee: ['D2'], nphi: ['CF2', 'CB8'], theme: 'Surveillance' },
  { spar: 'C6', jee: ['D3'], nphi: ['CF8', 'CB5'], theme: 'Human resources' },
  { spar: 'C7', jee: ['R1', 'R2'], nphi: ['CF2', 'CB3', 'CB6', 'CB7'], theme: 'Health emergency management' },
  { spar: 'C8', jee: ['R3'], nphi: ['CF7'], theme: 'Health services provision' },
  { spar: 'C9', jee: ['R4', 'P4'], nphi: ['CF9'], theme: 'Infection prevention and control, AMR' },
  { spar: 'C10', jee: ['R5'], nphi: ['CF4'], theme: 'Risk communication and community engagement' },
  { spar: 'C11', jee: ['PoE'], nphi: [], theme: 'Points of entry' },
  { spar: 'C12', jee: ['P5'], nphi: ['CF2', 'CB11'], theme: 'Zoonoses and One Health' },
  { spar: 'C13', jee: ['P6'], nphi: ['CF6'], theme: 'Food safety' },
  { spar: 'C14', jee: ['CE'], nphi: ['CF6'], theme: 'Chemical events' },
  { spar: 'C15', jee: ['RE'], nphi: ['CF6'], theme: 'Radiation emergencies' },
  { spar: null, jee: ['P8'], nphi: ['CF3'], theme: 'Immunization' },
]

// --- Scoring -----------------------------------------------------------------------------------
export interface ItemResponse { score: number | null; evidence: boolean; notApplicable: boolean; naReason?: string }
export type Responses = Record<string, ItemResponse>
const round1 = (x: number) => Math.round(x * 10) / 10
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export const activeItems = (c: Catalogue, extendedScope: boolean) => c.items.filter((i) => extendedScope || !i.extended)
export const itemById = (c: Catalogue, id: string) => c.items.find((i) => i.id === id) ?? null

export interface CatalogueScore {
  catalogue: { id: string; title: string; version: string; source: { title: string; url: string }; levels: string[]; disclaimer: string }
  sections: { id: string; name: string; percent: number | null; scored: number; total: number }[]
  items: { id: string; sectionId: string; name: string; critical: boolean; score: number | null; effective: number | null; evidence: boolean; notApplicable: boolean; percent: number | null }[]
  overall: number | null // percent
  completeness: number
  critical: { id: string; name: string; effective: number | null }[]
  priorities: { id: string; name: string; effective: number; sectionId: string }[]
  sdg?: { indicator: string; value: number | null }
}

/** Percent per item = effective level / 5 × 100; section = mean of items; overall = mean of sections (SPAR method). */
export function catalogueScore(c: Catalogue, responses: Responses, extendedScope = false): CatalogueScore {
  const items = activeItems(c, extendedScope).map((i) => {
    const r = responses[i.id]
    const na = !!r?.notApplicable
    const score = !na && r?.score != null ? r.score : null
    const effective = score === null ? null : c.evidenceCap !== null && !r!.evidence ? Math.min(score, c.evidenceCap) : score
    return { id: i.id, sectionId: i.sectionId, name: i.name, critical: !!i.critical, score, effective, evidence: !!r?.evidence, notApplicable: na, percent: effective === null ? null : effective * 20 }
  })
  const sections = c.sections.filter((s) => extendedScope || !s.extended).map((s) => {
    const mine = items.filter((i) => i.sectionId === s.id && !i.notApplicable)
    const scored = mine.map((i) => i.percent).filter((p): p is number => p !== null)
    const pcts = c.unansweredScoresZero ? mine.map((i) => i.percent ?? 0) : scored
    return { id: s.id, name: s.name, percent: pcts.length ? round1(mean(pcts)!) : null, scored: scored.length, total: mine.length }
  })
  const secPcts = sections.map((s) => s.percent).filter((p): p is number => p !== null)
  const applicable = items.filter((i) => !i.notApplicable)
  const answered = items.filter((i) => i.notApplicable || i.score !== null).length
  const overall = secPcts.length ? round1(mean(secPcts)!) : null
  return {
    catalogue: { id: c.id, title: c.title, version: c.version, source: c.source, levels: c.levels, disclaimer: c.disclaimer },
    sections, items, overall,
    completeness: items.length ? Math.round((answered / items.length) * 100) : 0,
    critical: items.filter((i) => i.critical).map((i) => ({ id: i.id, name: i.name, effective: i.effective })),
    priorities: applicable.filter((i) => i.effective !== null && i.effective <= 2).sort((a, b) => a.effective! - b.effective! || a.id.localeCompare(b.id))
      .map((i) => ({ id: i.id, name: i.name, effective: i.effective!, sectionId: i.sectionId })),
    ...(c.id === 'SPAR' ? { sdg: { indicator: 'SDG 3.d.1 — IHR capacity and health emergency preparedness (SPAR average)', value: overall } } : {}),
  }
}

/** Joins the latest NPHI, JEE and SPAR results on the crosswalk. */
export function crosswalkView(scores: Partial<Record<'NPHI' | 'JEE' | 'SPAR', CatalogueScore>>) {
  const pct = (cs: CatalogueScore | undefined, ids: string[], bySection: boolean) => {
    if (!cs) return null
    const vals = ids.map((id) => (bySection ? cs.sections.find((s) => s.id === id)?.percent : cs.items.find((i) => i.id === id)?.percent) ?? null).filter((v): v is number => v !== null)
    return vals.length ? round1(mean(vals)!) : null
  }
  return CROSSWALK.map((row) => {
    const spar = row.spar ? pct(scores.SPAR, [row.spar], true) : null
    const jee = pct(scores.JEE, row.jee, false)
    const nphi = pct(scores.NPHI, row.nphi, false)
    const vals = [spar, jee, nphi].filter((v): v is number => v !== null)
    return { ...row, sparPercent: spar, jeePercent: jee, nphiPercent: nphi, spread: vals.length > 1 ? round1(Math.max(...vals) - Math.min(...vals)) : null }
  })
}
