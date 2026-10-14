// Cross-framework requirement map: links CRAFT's frameworks (governance scorecard, ESG report
// checklist, organisational design, NPHI, JEE/SPAR, public-sector performance) to the SDG targets,
// Agenda 2063 goals and APRM thematic areas they contribute to. Used by the Framework mapping page.
// Self-check: `node src/lib/framework-map.test.ts`.

// SDG targets used in the map (short titles; see unstats.un.org/sdgs for the official wording).
export const SDG_TARGETS: Record<string, string> = {
  '3.8': 'Universal health coverage', '3.d': 'Early warning, risk reduction and management of health risks',
  '5.5': 'Women’s full participation and equal leadership opportunities', '8.5': 'Full and productive employment and decent work',
  '8.10': 'Strengthen domestic financial institutions', '9.1': 'Quality, reliable, sustainable infrastructure',
  '12.6': 'Companies adopt sustainable practices and sustainability reporting', '12.7': 'Sustainable public procurement',
  '13.2': 'Integrate climate change measures into policies and planning', '16.5': 'Substantially reduce corruption and bribery',
  '16.6': 'Effective, accountable and transparent institutions', '16.7': 'Responsive, inclusive, participatory decision-making',
  '16.10': 'Public access to information', '17.1': 'Domestic resource mobilisation', '17.9': 'Capacity building in developing countries',
  '17.14': 'Policy coherence for sustainable development', '17.17': 'Effective public, public-private and civil society partnerships',
  '17.18': 'Data capacity and availability',
}
export const SDG_GOALS: Record<string, string> = {
  '3': 'Good health and well-being', '5': 'Gender equality', '8': 'Decent work and economic growth', '9': 'Industry, innovation and infrastructure',
  '12': 'Responsible consumption and production', '13': 'Climate action', '16': 'Peace, justice and strong institutions', '17': 'Partnerships for the goals',
}
// Agenda 2063 goals referenced (of the 20 goals under the 7 aspirations).
export const A2063_GOALS: Record<string, string> = {
  G3: 'Healthy and well-nourished citizens', G4: 'Transformed economies', G7: 'Environmentally sustainable and climate-resilient economies and communities',
  G11: 'Democratic values, practices, universal principles of human rights, justice and the rule of law entrenched', G12: 'Capable institutions and transformative leadership in place',
  G17: 'Full gender equality in all spheres of life', G19: 'Africa as a major partner in global affairs and peaceful co-existence', G20: 'Africa takes full responsibility for financing her development',
}
export const APRM_AREAS: Record<string, string> = {
  DPG: 'Democracy and political governance', EGM: 'Economic governance and management', CG: 'Corporate governance', SED: 'Broad-based socio-economic development',
}

export type FrameworkId = 'CRAFT-GS' | 'CRAFT-QA' | 'CRAFT-OD' | 'NPHI' | 'JEE/SPAR' | 'PSP'
export const FRAMEWORKS: Record<FrameworkId, string> = {
  'CRAFT-GS': 'CRAFT Governance Scorecard', 'CRAFT-QA': 'ESG report quality checklist', 'CRAFT-OD': 'Organisational design & diagnosis',
  NPHI: 'NPHI development (Africa CDC)', 'JEE/SPAR': 'IHR capacities (WHO JEE and SPAR)', PSP: 'Public-sector performance',
}

export interface MapRow { framework: FrameworkId; element: string; label: string; sdg: string[]; a2063: string[]; aprm: string[] }
const r = (framework: FrameworkId, element: string, label: string, sdg: string[], a2063: string[], aprm: string[]): MapRow => ({ framework, element, label, sdg, a2063, aprm })

export const FRAMEWORK_MAP: MapRow[] = [
  // CRAFT Governance Scorecard pillars
  r('CRAFT-GS', 'leadership', 'Leadership, Board Effectiveness and Strategic Direction', ['16.6', '5.5'], ['G12'], ['CG']),
  r('CRAFT-GS', 'ethics', 'Ethics, Integrity and Organisational Culture', ['16.5'], ['G11'], ['DPG', 'CG']),
  r('CRAFT-GS', 'accountability', 'Accountability, Transparency and Stakeholder Engagement', ['16.6', '16.10'], ['G11', 'G12'], ['DPG', 'CG']),
  r('CRAFT-GS', 'riskmanagement', 'Risk Management, Internal Controls and Assurance', ['16.6'], ['G12'], ['EGM', 'CG']),
  r('CRAFT-GS', 'financial', 'Financial Stewardship and Fiduciary Responsibility', ['16.6', '17.1'], ['G12', 'G20'], ['EGM']),
  r('CRAFT-GS', 'operational', 'Operational Capability, Performance and Service Delivery', ['12.7', '16.6', '3.8'], ['G12'], ['EGM']),
  r('CRAFT-GS', 'people', 'People, Inclusion and Human-Capital Management', ['8.5', '5.5', '17.9'], ['G17', 'G12'], ['SED']),
  r('CRAFT-GS', 'sustainability', 'Sustainability, Climate and Responsible Value Creation', ['12.6', '13.2'], ['G7'], ['CG', 'SED']),
  r('CRAFT-GS', 'data', 'Data Governance, Cybersecurity and Digital Accountability', ['17.18', '16.10'], ['G12'], ['EGM']),
  r('CRAFT-GS', 'resilience', 'Institutional Resilience, Continuity and Succession', ['9.1', '13.2'], ['G7'], ['SED']),
  // ESG report quality checklist packs
  r('CRAFT-QA', 'S1', 'IFRS S1 general sustainability disclosures', ['12.6'], ['G4'], ['CG']),
  r('CRAFT-QA', 'S2', 'IFRS S2 climate-related disclosures', ['12.6', '13.2'], ['G7'], ['CG']),
  r('CRAFT-QA', 'SEC/FRC/JUR', 'National and exchange sustainability-reporting rules', ['12.6', '8.10'], ['G4'], ['CG', 'EGM']),
  r('CRAFT-QA', 'MOFI', 'MOFI-aligned governance of public investments', ['16.6', '17.1'], ['G12', 'G20'], ['EGM', 'CG']),
  // Organisational design
  r('CRAFT-OD', 'structure', 'Structure–environment fit and the nine design tests', ['16.6'], ['G12'], ['CG']),
  r('CRAFT-OD', 'functions', 'Functional units and interface relations', ['16.6', '8.5'], ['G12'], ['CG']),
  // NPHI
  r('NPHI', 'attributes', 'NPHI key attributes (science-based, accountable, legal authority)', ['3.d', '16.6'], ['G3', 'G12'], ['DPG']),
  r('NPHI', 'functions', 'NPHI core public health functions', ['3.d', '3.8'], ['G3'], ['SED']),
  r('NPHI', 'capacity', 'NPHI capacity building and sustainable financing', ['3.d', '17.1', '17.9'], ['G3', 'G20'], ['EGM']),
  // IHR
  r('JEE/SPAR', 'prevent', 'Prevent: legal, financing, coordination, AMR, zoonoses, food safety, biosafety, immunization', ['3.d', '3.8'], ['G3'], ['SED']),
  r('JEE/SPAR', 'detect', 'Detect: laboratory, surveillance, workforce', ['3.d', '17.18'], ['G3'], ['SED']),
  r('JEE/SPAR', 'respond', 'Respond: emergency management, services, IPC, RCCE', ['3.d', '3.8', '16.7'], ['G3'], ['SED']),
  r('JEE/SPAR', 'SPAR', 'SPAR average (SDG indicator 3.d.1)', ['3.d'], ['G3'], ['SED']),
  // Public-sector performance
  r('PSP', 'aprm', 'APRM thematic areas', ['16.5', '16.6', '16.7', '16.10'], ['G11', 'G12'], ['DPG', 'EGM', 'CG', 'SED']),
  r('PSP', 'pms', 'Results and national performance system', ['16.6', '17.18'], ['G12'], ['DPG', 'EGM']),
  r('PSP', 'pfm', 'Public financial management (PEFA pillars)', ['16.6', '17.1', '12.7'], ['G12', 'G20'], ['EGM']),
  r('PSP', 'eval', 'Evaluation (OECD-DAC criteria)', ['17.14', '17.18'], ['G12'], ['SED']),
  r('PSP', 'align', 'Agenda 2063, SDGs and South–South cooperation', ['17.14', '17.17', '17.9'], ['G19'], ['SED']),
]

/** Rows that contribute to an SDG goal (e.g. '16') or target (e.g. '16.6'). */
export const rowsForSdg = (goalOrTarget: string) =>
  FRAMEWORK_MAP.filter((row) => row.sdg.some((t) => t === goalOrTarget || t.split('.')[0] === goalOrTarget))
