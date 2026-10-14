// Public-sector performance assessment (CRAFT-PSP 1.0) for ministries, departments, agencies,
// subnational governments and public institutes. Brings together the layers through which African
// public bodies are held to account:
//  • APRM — the four thematic areas of the African Peer Review Mechanism (country-level reviews;
//    here, the institution's own contribution to each area);
//  • national performance management systems — strategic and annual performance plans, performance
//    contracts (e.g. Kenya performance contracting, Rwanda Imihigo, Nigeria ministerial performance
//    bonds tracked by the Central Delivery Coordination Unit, South Africa DPME planning and HOD PMDS),
//    delivery-unit reporting and data quality;
//  • public financial management — the seven PEFA 2016 pillars;
//  • evaluation — the six OECD-DAC criteria as revised in 2019 (coherence was added to the original five);
//  • Agenda 2063 and the SDGs — alignment and reporting, plus South–South cooperation.
// CRAFT's 1–5 maturity rubric; not an APRM review, PEFA assessment or official national rating.
import type { Catalogue, CatalogueItem, CatalogueSection } from './health-security.ts'

const sec = (id: string, name: string, intro: string): CatalogueSection => ({ id, name, intro })
const it = (sectionId: string, rows: [string, string, string, boolean?][]): CatalogueItem[] =>
  rows.map(([id, name, description, critical]) => ({ id, sectionId, name, description, critical }))

export const PSP: Catalogue = {
  id: 'PSP', title: 'Public-sector performance assessment', version: 'CRAFT-PSP 1.0 (2026-10-14)',
  source: { title: 'APRM thematic areas; PEFA 2016 framework; OECD-DAC evaluation criteria (2019); AU Agenda 2063; UN SDGs', url: 'https://aprm.au.int/en/about/states' },
  levels: ['1 — Absent', '2 — Initial / ad hoc', '3 — Defined', '4 — Implemented and resourced', '5 — Embedded, reviewed and improving'],
  evidenceCap: 2,
  sections: [
    sec('aprm', 'APRM thematic areas', 'The institution’s contribution to the four APRM governance areas.'),
    sec('pms', 'Results and national performance system', 'Planning, performance contracts, delivery-unit reporting and data quality.'),
    sec('pfm', 'Public financial management (PEFA pillars)', 'The seven pillars of the PEFA 2016 framework, at the institution’s level.'),
    sec('eval', 'Evaluation (OECD-DAC criteria)', 'How programmes perform against the six OECD-DAC criteria, and whether they are evaluated.'),
    sec('align', 'Agenda 2063, SDGs and cooperation', 'Alignment with continental and global goals, reporting, and South–South cooperation.'),
  ],
  items: [
    ...it('aprm', [
      ['APRM1', 'Democracy and political governance', 'Rule of law and compliance with statute; accountability to the legislature and oversight bodies; access to information; citizen participation; anti-corruption.', true],
      ['APRM2', 'Economic governance and management', 'Credible budgets, transparent procurement, revenue and expenditure reporting, and prudent management of assets and debt.', true],
      ['APRM3', 'Corporate governance', 'Effective boards of state-owned and regulated entities, ethics and conflict-of-interest management, stakeholder rights.'],
      ['APRM4', 'Broad-based socio-economic development', 'Service delivery outcomes, equity, gender and inclusion, and sustainable development results.'],
    ]),
    ...it('pms', [
      ['PMS1', 'Strategic plan aligned with the national development plan', 'Multi-year strategic plan with outcomes and indicators traceable to the national plan and sector policy.'],
      ['PMS2', 'Annual performance plan with targets', 'Annual plan with measurable targets, baselines, owners and budget links.'],
      ['PMS3', 'Performance contract or agreement', 'Signed performance contract or agreement for the institution and its head (e.g. performance contracting, Imihigo, ministerial performance bonds, HOD PMDS).', true],
      ['PMS4', 'Reporting to the centre of government', 'Quarterly or regular progress reports to the delivery unit, presidency, cabinet office or planning ministry.'],
      ['PMS5', 'Performance data quality', 'Indicator definitions, data sources, verification and audit of performance information.'],
      ['PMS6', 'Individual performance linked to organisational targets', 'Staff appraisal objectives cascade from the institution’s targets; consequences are applied.'],
      ['PMS7', 'Results used in decisions and budgets', 'Performance results inform budget allocations, corrective action and the next plan.'],
    ]),
    ...it('pfm', [
      ['PEFA1', 'Budget reliability', 'Actual spending and revenue close to the approved budget, by total and composition.'],
      ['PEFA2', 'Transparency of public finances', 'Comprehensive budget classification and documentation; public access to fiscal information.'],
      ['PEFA3', 'Management of assets and liabilities', 'Asset registers, investment appraisal and management of debt and fiscal risks.'],
      ['PEFA4', 'Policy-based fiscal strategy and budgeting', 'Medium-term perspective, budget preparation process and legislative scrutiny.'],
      ['PEFA5', 'Predictability and control in budget execution', 'Revenue administration, cash and payroll controls, procurement and internal control and audit.', true],
      ['PEFA6', 'Accounting and reporting', 'Timely reconciliations, in-year budget reports and annual financial reports.'],
      ['PEFA7', 'External scrutiny and audit', 'Supreme audit institution coverage and legislative follow-up of audit findings.', true],
    ]),
    ...it('eval', [
      ['DAC1', 'Relevance', 'Programmes respond to beneficiaries’ and national needs and priorities.'],
      ['DAC2', 'Coherence', 'Compatible with other interventions in the country, sector and institution (added in 2019).'],
      ['DAC3', 'Effectiveness', 'Objectives and results are achieved, including differential results across groups.'],
      ['DAC4', 'Efficiency', 'Results delivered economically and on time.'],
      ['DAC5', 'Impact', 'Significant higher-level effects, intended or not.'],
      ['DAC6', 'Sustainability', 'Benefits continue after funding or programme support ends.'],
      ['DAC7', 'Evaluation practice', 'Programmes are evaluated independently, findings are published and management responses tracked.'],
    ]),
    ...it('align', [
      ['ALN1', 'Agenda 2063 alignment', 'Plans and results mapped to Agenda 2063 aspirations and goals and the current ten-year implementation plan.'],
      ['ALN2', 'SDG alignment and reporting', 'Plans mapped to SDG targets; contribution to national SDG reporting and Voluntary National Reviews.'],
      ['ALN3', 'Continental and regional commitments', 'Participation in APRM national processes, AU and regional economic community frameworks.'],
      ['ALN4', 'South–South and triangular cooperation', 'Knowledge exchange and cross-border cooperation with measurable technical results.'],
    ]),
  ],
  disclaimer: 'CRAFT-PSP applies CRAFT’s maturity rubric to the APRM areas, national performance systems, PEFA pillars, OECD-DAC criteria and Agenda 2063/SDG alignment. It is not an APRM country review, a PEFA assessment or an official performance rating.',
}
