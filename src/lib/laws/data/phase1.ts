// Phase 1: NG, KE, ZA, MA, EG, SN, MU, CV, US, UK, EU. Entries start `review: 'pending'` until the founders approve them.
// Summaries are CRAFT's own words. `secondary` sources are copies or guides hosted outside government: verify before relying on them.
import type { CraftDuty, LawEntry } from '../types.ts'

const C = '2026-10-18'
const off = (url: string) => ({ url, kind: 'official' as const, checked: C })
const sec = (url: string) => ({ url, kind: 'secondary' as const, checked: C })
/** The four questions every data protection law raises for CRAFT itself, each to be confirmed. */
const dataNotes = (registration: string, transfer: string, breach: string, rep: string): { duty: CraftDuty; note: string; status: 'needed' }[] => [
  { duty: 'registration', note: registration, status: 'needed' },
  { duty: 'cross-border', note: transfer, status: 'needed' },
  { duty: 'breach-notice', note: breach, status: 'needed' },
  { duty: 'local-representative', note: rep, status: 'needed' },
]

export const PHASE1_LAWS: LawEntry[] = [
  // ---- Nigeria ----
  { id: 'NG-company-1', jurisdiction: 'NG', area: 'company', title: 'Companies and Allied Matters Act, 2020', citation: 'Act No. 3 of 2020',
    regulator: 'Corporate Affairs Commission',
    summary: 'Governs incorporating and running companies, limited liability partnerships and business names, and registering incorporated trustees for charities, NGOs and associations. Sets duties of directors and trustees, annual returns, record keeping and disclosure of persons with significant control.',
    source: sec('https://www.judy.legal/legislation/akn/ng/act/2020/3'), review: 'pending' },
  { id: 'NG-data-1', jurisdiction: 'NG', area: 'data', title: 'Nigeria Data Protection Act, 2023', citation: 'Act of 2023 (Official Gazette, 2023)',
    regulator: 'Nigeria Data Protection Commission',
    summary: 'Requires a lawful basis for processing personal data, transparency to data subjects, security safeguards and respect for data subject rights. Controllers and processors of major importance must register with the Commission. Restricts transfers abroad without adequate protection and requires breach notification to the Commission.',
    source: off('https://ndpc.gov.ng/resources/'),
    craftNotes: dataNotes(
      'Confirm whether DiBadili is a data controller of major importance for Nigerian users and, if so, register with the NDPC.',
      'Record the transfer basis for Nigerian personal data hosted outside Nigeria (adequacy, safeguards or consent).',
      'Breach-notice procedure to the NDPC within the Act\'s deadline (72 hours) and to affected users where risk is high.',
      'Confirm whether a Nigerian representative or DPO filing is required for a foreign-established controller.'),
    review: 'pending' },
  { id: 'NG-integrity-1', jurisdiction: 'NG', area: 'integrity', title: 'Corrupt Practices and Other Related Offences Act, 2000', citation: 'Act No. 5 of 2000',
    regulator: 'Independent Corrupt Practices and Other Related Offences Commission (ICPC)',
    summary: 'Makes offering, giving, soliciting and accepting bribes, and related abuse of office, criminal offences, and sets up the ICPC to receive complaints, investigate, prosecute and review public bodies\' systems to prevent corruption.',
    source: off('https://icpc.gov.ng/the-icpc-act-at-20-overview-of-the-act/'), review: 'pending' },
  { id: 'NG-integrity-2', jurisdiction: 'NG', area: 'integrity', title: 'Money Laundering (Prevention and Prohibition) Act, 2022', citation: 'Act No. 14 of 2022',
    regulator: 'Special Control Unit against Money Laundering (EFCC); Nigerian Financial Intelligence Unit',
    summary: 'Requires financial institutions and designated non-financial businesses to identify customers, keep records, apply limits on large cash payments and report suspicious and large transactions. Repeals the 2011 money laundering law.',
    source: sec('https://lawpadi.com/money-laundering-prevention-and-prohibition-act-2022/'), review: 'pending' },
  { id: 'NG-procurement-1', jurisdiction: 'NG', area: 'procurement', title: 'Public Procurement Act, 2007', citation: 'Act No. 14 of 2007',
    regulator: 'Bureau of Public Procurement',
    summary: 'Sets the rules for federal public procurement: open competitive bidding as the default, procurement planning, thresholds for approvals, record keeping, complaints and offences for bid rigging and bribery. Applies to bodies using federal funds.',
    source: sec('https://lite.judy.legal/amp/legislation/akn/ng/act/2007/14/'),
    reformNote: 'A review of the Act is under discussion between the Bureau and the National Assembly.', review: 'pending' },
  { id: 'NG-governance-1', jurisdiction: 'NG', area: 'governance', title: 'Nigerian Code of Corporate Governance 2018', citation: 'Financial Reporting Council of Nigeria, 2018',
    regulator: 'Financial Reporting Council of Nigeria',
    summary: 'Principles on board composition and independence, board committees, risk management, audit, remuneration, shareholder relations and disclosure. Companies report how they apply each principle ("apply and explain"); sector regulators add their own codes.',
    source: sec('https://www.ecgi.global/sites/default/files/codes/documents/nccg_2018.pdf'), review: 'pending' },
  { id: 'NG-labour-1', jurisdiction: 'NG', area: 'labour', title: 'Labour Act', citation: 'Cap. L1, Laws of the Federation of Nigeria 2004',
    regulator: 'Federal Ministry of Labour and Employment',
    summary: 'Requires written terms of employment, regulates wages, hours, holidays, sick leave and notice of termination, and protects workers in recruitment and special categories. Minimum wage is set by separate legislation.',
    source: sec('https://lawsofnigeria.placng.org/laws/L1.pdf'), review: 'pending' },
  { id: 'NG-eia-1', jurisdiction: 'NG', area: 'eia', title: 'Environmental Impact Assessment Act', citation: 'Cap. E12, Laws of the Federation of Nigeria 2004',
    regulator: 'Federal Ministry of Environment (EIA Department)',
    summary: 'Requires proponents of major new projects to carry out an environmental impact assessment, with public consultation, before work starts, and to obtain approval and follow the conditions set.',
    source: sec('https://lawsofnigeria.placng.org/laws/E12.pdf'),
    reformNote: 'A bill to repeal and replace the Act was introduced in the National Assembly in 2023.', review: 'pending' },
]
