// The 19 governance domains grouped into the 5 G2G-ICGMT pillars, used by the
// workspace assessment wizard (scores are persisted per pillar/domain via the API).
export const GOVERNANCE_DOMAINS: Record<string, string[]> = {
  Governance: ['Board Oversight', 'Leadership & Ethics', 'Strategy & Planning', 'Stakeholder Engagement'],
  Fiduciary: ['Financial Management', 'Internal Controls', 'Procurement', 'Asset Management'],
  'Grant Management': ['Programme Delivery', 'Monitoring & Evaluation', 'Human Resources', 'Sub-recipient Oversight'],
  'USG Compliance': ['Legal & Regulatory', 'Risk Management', 'Audit & Assurance', 'Anti-Corruption & Integrity'],
  'Digital Readiness': ['IT & Data Management', 'Cybersecurity', 'Transparency & Reporting'],
}
export const ALL_DOMAINS = Object.entries(GOVERNANCE_DOMAINS).flatMap(([pillar, ds]) => ds.map(domain => ({ pillar, domain })))
