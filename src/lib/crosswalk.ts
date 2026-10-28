// ============================================================================
// Crosswalk: the external frameworks CRAFT indicators are mapped to.
// ----------------------------------------------------------------------------
// Names, owners, element ids and short labels only. Every label is CRAFT's own
// wording: no text from any framework, standard or tool is reproduced here.
// Mapping an indicator to an element means CRAFT judges it relevant to that
// element. It is not an endorsement by, or certification against, the framework.
// Self-check: `node src/lib/crosswalk.test.ts`.
// ============================================================================

import type { CrosswalkRef } from './foundationModules.ts'

/** certifiable: an accredited body can certify against it · verified: statements are verified by an
 *  accredited body, not certified · guidance: cannot be certified. */
export type FrameworkKind = 'certifiable' | 'verified' | 'guidance' | 'framework' | 'regulation' | 'tool'

export interface ExternalFramework {
  id: string
  name: string
  owner: string
  kind: FrameworkKind
  elements: { id: string; label: string }[]
}

const el = (pairs: Array<[string, string]>) => pairs.map(([id, label]) => ({ id, label }))
const ms = el([['MS', 'Management system as a whole']])

const COSO_PRINCIPLES: Array<[string, string]> = [
  ['P1', 'Ethics and integrity'], ['P2', 'Independent oversight'], ['P3', 'Structure and authority'],
  ['P4', 'Competent people'], ['P5', 'Accountability for control'], ['P6', 'Clear objectives'],
  ['P7', 'Risks identified and analysed'], ['P8', 'Fraud risk considered'], ['P9', 'Significant change assessed'],
  ['P10', 'Control activities chosen'], ['P11', 'Technology controls'], ['P12', 'Policies and procedures'],
  ['P13', 'Quality information'], ['P14', 'Internal communication'], ['P15', 'External communication'],
  ['P16', 'Ongoing and separate evaluations'], ['P17', 'Deficiencies reported and fixed'],
]

// COSO ERM (2017) principles, CRAFT's own short wording.
const ERM_PRINCIPLES: Array<[string, string]> = [
  ['P1', 'Board oversight of risk'], ['P2', 'Operating structures in place'], ['P3', 'Desired culture defined'],
  ['P4', 'Commitment to core values'], ['P5', 'Capable people attracted, developed and kept'],
  ['P6', 'Operating context analysed'], ['P7', 'Risk appetite defined'], ['P8', 'Alternative strategies evaluated'],
  ['P9', 'Objectives set'], ['P10', 'Risks identified'], ['P11', 'Severity of risk assessed'], ['P12', 'Risks prioritised'],
  ['P13', 'Risk responses put in place'], ['P14', 'Portfolio view of risk developed'], ['P15', 'Significant change assessed'],
  ['P16', 'Risk and performance reviewed'], ['P17', 'Risk management improved'], ['P18', 'Information and technology used'],
  ['P19', 'Risk information communicated'], ['P20', 'Risk, culture and performance reported'],
]

export const EXTERNAL_FRAMEWORKS: ExternalFramework[] = [
  // ---- Fiduciary, governance and risk ----
  { id: 'coso-ic', name: 'COSO Internal Control — Integrated Framework (2013)', owner: 'COSO', kind: 'framework',
    elements: el([['CE', 'Control environment'], ['RA', 'Risk assessment'], ['CA', 'Control activities'],
      ['IC', 'Information and communication'], ['MA', 'Monitoring activities'], ...COSO_PRINCIPLES]) },
  { id: 'coso-erm', name: 'COSO Enterprise Risk Management (2017)', owner: 'COSO', kind: 'framework',
    elements: el([['GC', 'Governance and culture'], ['SO', 'Strategy and objective-setting'], ['PF', 'Performance'],
      ['RR', 'Review and revision'], ['ICR', 'Information, communication and reporting'], ...ERM_PRINCIPLES]) },
  { id: 'iso-31000', name: 'ISO 31000:2018 Risk management', owner: 'ISO', kind: 'guidance',
    elements: el([['4', 'Principles'], ['5', 'Framework'], ['6.3', 'Scope and context'], ['6.4', 'Risk assessment'],
      ['6.5', 'Risk treatment'], ['6.6', 'Monitoring and review'], ['6.7', 'Recording and reporting']]) },
  { id: 'ifc-cgdf', name: 'IFC Corporate Governance Development Framework', owner: 'IFC and partner development finance institutions', kind: 'framework',
    elements: el([['COMMIT', 'Commitment to governance'], ['BOARD', 'Board structure and functioning'], ['CONTROL', 'Control environment'],
      ['DISCLOSURE', 'Disclosure and transparency'], ['SHAREHOLDERS', 'Treatment of shareholders'], ['STAKEHOLDERS', 'Stakeholder governance']]) },
  { id: 'nccg-2018', name: 'Nigerian Code of Corporate Governance 2018', owner: 'Financial Reporting Council of Nigeria', kind: 'regulation',
    elements: el([['BOARD', 'Board of directors'], ['ASSURANCE', 'Assurance'], ['SHAREHOLDERS', 'Relationship with shareholders'],
      ['CONDUCT', 'Business conduct and ethics'], ['SUSTAINABILITY', 'Sustainability'], ['TRANSPARENCY', 'Transparency']]) },
  { id: 'pefa', name: 'PEFA framework (2016)', owner: 'PEFA Secretariat', kind: 'framework',
    elements: el([['I', 'Budget reliability'], ['II', 'Transparency of public finances'], ['III', 'Assets and liabilities'],
      ['IV', 'Policy-based planning and budgeting'], ['V', 'Predictability and control in budget execution'],
      ['VI', 'Accounting and reporting'], ['VII', 'External scrutiny and audit']]) },
  // ---- Safeguards and sustainability ----
  { id: 'afdb-iss', name: 'AfDB Integrated Safeguards System', owner: 'African Development Bank', kind: 'framework',
    elements: el([['OS1', 'E&S risk assessment and management'], ['OS2', 'Labour and working conditions'], ['OS3', 'Resources and pollution'],
      ['OS4', 'Community health, safety and security'], ['OS5', 'Land and resettlement'], ['OS6', 'Habitats and biodiversity'],
      ['OS7', 'Vulnerable groups'], ['OS8', 'Cultural heritage'], ['OS9', 'Financial intermediaries'], ['OS10', 'Stakeholder engagement and disclosure']]) },
  { id: 'ifrs-s1', name: 'IFRS S1 General sustainability-related disclosures', owner: 'IFRS Foundation', kind: 'framework',
    elements: el([['GOV', 'Governance'], ['STRAT', 'Strategy'], ['RISK', 'Risk management'], ['METRICS', 'Metrics and targets']]) },
  { id: 'ifrs-s2', name: 'IFRS S2 Climate-related disclosures', owner: 'IFRS Foundation', kind: 'framework',
    elements: el([['GOV', 'Governance'], ['STRAT', 'Strategy'], ['RISK', 'Risk management'], ['METRICS', 'Metrics and targets']]) },
  // ---- Organisational health and design (concept level: dimension names only) ----
  { id: 'mck-ohi', name: 'Organizational Health Index (concept level)', owner: 'McKinsey & Company', kind: 'tool',
    elements: el([['DIRECTION', 'Direction'], ['LEADERSHIP', 'Leadership'], ['CULTURE', 'Culture and climate'], ['ACCOUNTABILITY', 'Accountability'],
      ['COORDINATION', 'Coordination and control'], ['CAPABILITIES', 'Capabilities'], ['MOTIVATION', 'Motivation'],
      ['EXTERNAL', 'External orientation'], ['INNOVATION', 'Innovation and learning']]) },
  { id: 'mck-7s', name: '7S Framework', owner: 'McKinsey & Company', kind: 'framework',
    elements: el([['STRATEGY', 'Strategy'], ['STRUCTURE', 'Structure'], ['SYSTEMS', 'Systems'], ['SHARED_VALUES', 'Shared values'],
      ['STYLE', 'Style'], ['STAFF', 'Staff'], ['SKILLS', 'Skills']]) },
  { id: 'nadler-tushman', name: 'Congruence Model', owner: 'David Nadler and Michael Tushman', kind: 'framework',
    elements: el([['WORK', 'The work'], ['PEOPLE', 'The people'], ['FORMAL', 'Formal organisation'], ['INFORMAL', 'Informal organisation']]) },
  { id: 'burke-litwin', name: 'Model of Organizational Performance and Change', owner: 'W. Warner Burke and George Litwin', kind: 'framework',
    elements: el([['EXTERNAL', 'External environment'], ['MISSION', 'Mission and strategy'], ['LEADERSHIP', 'Leadership'], ['CULTURE', 'Culture'],
      ['STRUCTURE', 'Structure'], ['PRACTICES', 'Management practices'], ['SYSTEMS', 'Systems and policies'], ['CLIMATE', 'Work climate'],
      ['TASK_SKILLS', 'Task and skills fit'], ['NEEDS', 'Individual needs'], ['MOTIVATION', 'Motivation'], ['PERFORMANCE', 'Performance']]) },
  { id: 'star-model', name: 'Star Model', owner: 'Jay Galbraith', kind: 'framework',
    elements: el([['STRATEGY', 'Strategy'], ['STRUCTURE', 'Structure'], ['PROCESSES', 'Processes'], ['REWARDS', 'Rewards'], ['PEOPLE', 'People']]) },
  { id: 'lencioni', name: 'Four Disciplines of Organizational Health', owner: 'Patrick Lencioni', kind: 'framework',
    elements: el([['COHESIVE_TEAM', 'Cohesive leadership team'], ['CLARITY', 'Creating clarity'], ['OVERCOMMUNICATE', 'Communicating clarity'],
      ['REINFORCE', 'Reinforcing clarity']]) },
  { id: 'cvf', name: 'Competing Values Framework', owner: 'Kim Cameron and Robert Quinn', kind: 'framework',
    elements: el([['CLAN', 'Collaborate'], ['ADHOCRACY', 'Create'], ['MARKET', 'Compete'], ['HIERARCHY', 'Control']]) },
  { id: 'engagement', name: 'Employee engagement research (concept level)', owner: 'Various researchers', kind: 'framework',
    elements: el([['MEASURE', 'Engagement measured'], ['ENABLERS', 'Enablers in place'], ['ACTION', 'Results acted on']]) },
  { id: 'bsc', name: 'Balanced Scorecard', owner: 'Robert Kaplan and David Norton', kind: 'framework',
    elements: el([['FINANCIAL', 'Financial perspective'], ['CUSTOMER', 'People served perspective'], ['PROCESS', 'Internal process perspective'],
      ['LEARNING', 'Learning and growth perspective'], ['CASCADE', 'Strategy translated into objectives, measures and targets, and cascaded']]) },
  { id: 'tnfd', name: 'TNFD Recommendations and LEAP approach', owner: 'Taskforce on Nature-related Financial Disclosures', kind: 'framework',
    elements: el([['GOV', 'Governance of nature-related issues'], ['STRAT', 'Nature in strategy'], ['RIM', 'Risk and impact management'], ['MT', 'Metrics and targets'],
      ['L', 'Locate the interface with nature'], ['E', 'Evaluate dependencies and impacts'], ['A', 'Assess risks and opportunities'], ['P', 'Prepare to respond and report']]) },
  // ---- Change management ----
  { id: 'adkar', name: 'ADKAR Model', owner: 'Prosci', kind: 'framework',
    elements: el([['AWARENESS', 'Awareness'], ['DESIRE', 'Desire'], ['KNOWLEDGE', 'Knowledge'], ['ABILITY', 'Ability'], ['REINFORCEMENT', 'Reinforcement']]) },
  { id: 'kotter', name: 'Process for Leading Change', owner: 'John Kotter', kind: 'framework',
    elements: el([['URGENCY', 'Urgency'], ['COALITION', 'Guiding coalition'], ['VISION', 'Vision'], ['VOLUNTEERS', 'Broad support'],
      ['BARRIERS', 'Barriers removed'], ['WINS', 'Short-term wins'], ['ACCELERATE', 'Sustained acceleration'], ['INSTITUTE', 'Change institutionalised']]) },
  { id: 'lewin', name: 'Change Model', owner: 'Kurt Lewin', kind: 'framework',
    elements: el([['UNFREEZE', 'Unfreeze'], ['CHANGE', 'Change'], ['REFREEZE', 'Refreeze']]) },
  { id: 'bridges', name: 'Transition Model', owner: 'William Bridges', kind: 'framework',
    elements: el([['ENDING', 'Endings'], ['NEUTRAL', 'Neutral zone'], ['BEGINNING', 'New beginnings']]) },
  // ---- Information security ----
  { id: 'nist-csf-2', name: 'NIST Cybersecurity Framework 2.0', owner: 'US National Institute of Standards and Technology', kind: 'guidance',
    elements: el([['GV', 'Govern'], ['ID', 'Identify'], ['PR', 'Protect'], ['DE', 'Detect'], ['RS', 'Respond'], ['RC', 'Recover']]) },
  // ---- ISO standards (standard-level element only in stage 1) ----
  ...([
    ['iso-9001', 'ISO 9001 Quality management systems'], ['iso-14001', 'ISO 14001 Environmental management systems'],
    ['iso-22301', 'ISO 22301 Business continuity management systems'], ['iso-27001', 'ISO/IEC 27001 Information security management systems'],
    ['iso-27701', 'ISO/IEC 27701 Privacy information management'], ['iso-37001', 'ISO 37001 Anti-bribery management systems'],
    ['iso-37301', 'ISO 37301 Compliance management systems'], ['iso-42001', 'ISO/IEC 42001 AI management systems'],
    ['iso-45001', 'ISO 45001 Occupational health and safety management systems'], ['iso-50001', 'ISO 50001 Energy management systems'],
  ] as const).map(([id, name]): ExternalFramework => ({ id, name, owner: 'ISO', kind: 'certifiable', elements: ms })),
  { id: 'iso-14064-1', name: 'ISO 14064-1 Greenhouse gas quantification and reporting', owner: 'ISO', kind: 'verified', elements: ms },
  ...([
    ['iso-37000', 'ISO 37000 Governance of organisations'], ['iso-37002', 'ISO 37002 Whistleblowing management systems'],
    ['iso-26000', 'ISO 26000 Social responsibility'], ['iso-30414', 'ISO 30414 Human capital reporting'],
    ['iso-30415', 'ISO 30415 Diversity and inclusion'], ['iso-14046', 'ISO 14046 Water footprint'],
    ['iso-14067', 'ISO 14067 Carbon footprint of products'],
    ['iso-14040', 'ISO 14040 Life cycle assessment'], ['iso-10002', 'ISO 10002 Customer complaints handling'],
    ['iso-22395', 'ISO 22395 Support for vulnerable persons in an emergency'], ['iso-20400', 'ISO 20400 Sustainable procurement'],
  ] as const).map(([id, name]): ExternalFramework => ({ id, name, owner: 'ISO', kind: 'guidance', elements: ms })),
]

// Frameworks CRAFT already assesses in its own modules (see src/lib/frameworks.ts).
const TOOL = el([['TOOL', 'The tool as a whole']])
EXTERNAL_FRAMEWORKS.push(
  { id: 'pact-omt', name: 'Organizational Mapping Tool (OMT)', owner: 'Pact', kind: 'tool', elements: TOOL },
  { id: 'pact-oca', name: 'Organizational Capacity Assessment and Organizational Performance Index', owner: 'Pact', kind: 'tool', elements: TOOL },
  { id: 'gf-pr', name: 'Principal Recipient financial reporting', owner: 'The Global Fund', kind: 'tool', elements: TOOL },
  { id: 'gfa', name: 'GFA Business Diagnostic', owner: 'GFA Consulting Group', kind: 'tool', elements: TOOL },
  { id: 'oecd-ai', name: 'OECD AI classification and UNESCO ethical impact assessment', owner: 'OECD and UNESCO', kind: 'guidance', elements: TOOL },
  { id: 'g7-ai', name: 'G7 AI governance toolkit for the public sector', owner: 'G7', kind: 'guidance', elements: TOOL },
)

/** Shown wherever TNFD is named, so users know its status. */
export const TNFD_STATUS_NOTE = 'As of October 2026, TNFD is concluding its technical work and the ISSB is developing nature-related requirements that build on it (an exposure draft was expected around COP17); check the ISSB for the current position.'

export function frameworkById(id: string): ExternalFramework | undefined {
  return EXTERNAL_FRAMEWORKS.find((f) => f.id === id)
}

/** Problems with a set of crosswalk refs; empty when every ref names a registered framework element. */
export function crosswalkProblems(refs: { indicatorId: string; refs: CrosswalkRef[] }[]): string[] {
  const out: string[] = []
  for (const { indicatorId, refs: rs } of refs) {
    for (const r of rs) {
      const f = frameworkById(r.framework)
      if (!f) out.push(`${indicatorId}: unknown framework "${r.framework}"`)
      else if (!f.elements.some((e) => e.id === r.ref)) out.push(`${indicatorId}: ${f.id} has no element "${r.ref}"`)
    }
  }
  return out
}
