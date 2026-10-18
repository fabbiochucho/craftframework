// Shared builders for the law data files. Summaries are CRAFT's own words; `secondary` sources must be verified.
import type { CraftDuty, LawArea, LawEntry } from '../types.ts'

/** The four questions every data protection law raises for CRAFT itself, each to be confirmed. */
export const dataNotes = (registration: string, transfer: string, breach: string, rep: string): { duty: CraftDuty; note: string; status: 'needed' }[] => [
  { duty: 'registration', note: registration, status: 'needed' },
  { duty: 'cross-border', note: transfer, status: 'needed' },
  { duty: 'breach-notice', note: breach, status: 'needed' },
  { duty: 'local-representative', note: rep, status: 'needed' },
]
/** Standard CRAFT-duty notes where the data law gives few specifics; every item stays "to confirm". */
export const genericDataNotes = (regulator: string) => dataNotes(
  `Confirm whether processing this country's users' data requires registration, declaration or authorisation with ${regulator}.`,
  "Confirm the conditions for hosting this country's personal data abroad and record the basis used.",
  'Confirm whether and when security breaches must be notified to the regulator.',
  'Confirm whether a foreign controller needs a local representative.')

// ---- Templates used by the phase 2 regional files ----
// Each returns an entry without an id; `finalize` numbers them `${J}-${area}-${n}`. Summaries describe the typical
// obligations in that area in CRAFT's words; `extra` adds what is specific to the country.
export const P2 = '2026-10-18'
type Src = { url: string; kind: 'official' | 'secondary' }
export const O = (url: string): Src => ({ url, kind: 'official' })
export const S = (url: string): Src => ({ url, kind: 'secondary' })
export type Base = { title: string; citation: string; regulator: string | null; source: Src; extra?: string; reformNote?: string }
const mk = (j: string, area: LawArea, b: Base, summary: string, more: Partial<LawEntry> = {}): LawEntry => ({
  id: '', jurisdiction: j, area, title: b.title, citation: b.citation, regulator: b.regulator,
  summary: b.extra ? `${summary} ${b.extra}` : summary, source: { ...b.source, checked: P2 },
  ...(b.reformNote ? { reformNote: b.reformNote } : {}), review: 'pending', ...more,
})
/** A hand-written entry: `summary` is used as given. */
export const entry = (j: string, area: LawArea, b: Base, summary: string, more: Partial<LawEntry> = {}) => mk(j, area, b, summary, more)
const by = (r: string | null, lead: string) => (r ? `${lead} ${r}` : '')

export const T = {
  company: (j: string, b: Base) => mk(j, 'company', b, "Governs forming and running companies: registration, managers' and directors' duties, accounts, audit and annual filings."),
  ngo: (j: string, b: Base) => mk(j, 'company', b, 'Sets how associations and NGOs are formed, registered, governed and supervised, including reporting and rules on their activities and funding.'),
  data: (j: string, b: Base) => mk(j, 'data', b, `Requires a lawful basis and transparency for processing personal data, respect for data subject rights and security safeguards, with registration or authorisation duties and limits on transfers abroad${by(b.regulator, ', overseen by')}.`, { craftNotes: genericDataNotes(b.regulator ?? 'the regulator') }),
  noData: (j: string, b: Base) => mk(j, 'data', b, 'No comprehensive data protection law or authority is in force; only sector rules and regional instruments apply. Handle personal data to good-practice standards and watch for new legislation.', { noLaw: true, craftNotes: genericDataNotes('any future regulator') }),
  aml: (j: string, b: Base) => mk(j, 'integrity', b, `Requires financial institutions and designated businesses and professions to identify customers and beneficial owners, keep records and report suspicious transactions${by(b.regulator, ' to')}.`),
  corruption: (j: string, b: Base) => mk(j, 'integrity', b, `Criminalises bribery and related abuse of office${by(b.regulator, ' and gives powers to prevent, investigate or refer corruption to')}.`),
  procurement: (j: string, b: Base) => mk(j, 'procurement', b, `Sets rules for procurement by public bodies: competitive tendering as the default, publication, evaluation and award, complaints and sanctions${by(b.regulator, ', overseen by')}.`),
  govCode: (j: string, b: Base) => mk(j, 'governance', b, 'Principles on board composition and independence, committees, risk, audit and disclosure for the companies in scope, applied on a comply-or-explain basis.'),
  govNone: (j: string, b: Base) => mk(j, 'governance', b, 'There is no standalone national corporate governance code. Board, audit and disclosure rules come from company law and, for banks and listed companies, regulator rules.', { noLaw: true }),
  labour: (j: string, b: Base) => mk(j, 'labour', b, 'Sets core employment terms: contracts, working hours, leave, wages, health and safety and dismissal procedures, with collective agreements adding terms.'),
  eia: (j: string, b: Base) => mk(j, 'eia', b, `Requires an environmental impact assessment, with public consultation, and approval${by(b.regulator, ' from')} before listed projects start, followed by monitoring of conditions.`),
  sustain: (j: string, b: Base) => mk(j, 'sustainability', b, 'Sets the principles of national environmental protection: pollution and waste control, natural resources and the duties of public bodies and enterprises.'),
  bank: (j: string, b: Base) => mk(j, 'financial', b, `Licenses and supervises banks and other financial institutions with prudential, governance and reporting rules${by(b.regulator, ' under')}.`),
  accounting: (j: string, b: Base) => mk(j, 'financial', b, 'Sets the accounting framework for financial statements and the audit duties of companies above set thresholds.'),
  securities: (j: string, b: Base) => mk(j, 'capital', b, `Regulates public offers, listing and disclosure by issuers, licensed market intermediaries and collective investment schemes, and prohibits market abuse${by(b.regulator, ', under')}.`),
  noMarket: (j: string, b: Base) => mk(j, 'capital', b, 'There is no domestic stock exchange or dedicated capital markets law; public offers are rare and governed by company and banking rules.', { noLaw: true }),
  tax: (j: string, b: Base) => mk(j, 'tax', b, `Sets income tax, VAT or sales tax and withholding duties, with registration and filing${by(b.regulator, ' with')}. Non-profits may qualify for exemptions on application but usually still withhold and file.`),
  competition: (j: string, b: Base) => mk(j, 'competition', b, `Prohibits anti-competitive agreements and abuse of dominance and requires notification of qualifying mergers${by(b.regulator, ' to')}.`),
  noCompetition: (j: string, b: Base) => mk(j, 'competition', b, 'There is no standalone national competition law or authority in operation; regional rules, where they apply, and general commercial law govern.', { noLaw: true }),
  consumer: (j: string, b: Base) => mk(j, 'consumer', b, `Requires fair dealing with consumers: clear information and pricing, fair contract terms, safe goods and services, and complaint and redress routes${by(b.regulator, ', enforced by')}.`),
  noConsumer: (j: string, b: Base) => mk(j, 'consumer', b, 'No standalone consumer protection law was confirmed; consumer rules sit in commercial, competition or sector legislation. Confirm before relying on this.', { noLaw: true }),
  sanctions: (j: string, b: Base) => mk(j, 'sanctions', b, `Gives effect to UN Security Council targeted financial sanctions: screen customers, partners and payees, freeze designated persons' funds without delay and report${by(b.regulator, ' to')}.`),
  forex: (j: string, b: Base) => mk(j, 'forex', b, `Regulates foreign currency accounts, payments and transfers abroad and repatriation of foreign earnings; some transactions must go through authorised banks or need approval${by(b.regulator, ' from')}.`),
  licensing: (j: string, b: Base) => mk(j, 'licensing', b, `Sets how businesses and investors register, obtain licences and access incentives${by(b.regulator, ', through')}, with sector permits issued by the relevant regulators.`),
}

/** Regional frameworks shared by several member states. */
export const R = {
  ohadaCompany: (j: string) => T.company(j, { title: 'OHADA Uniform Act on Commercial Companies and Economic Interest Groups', citation: 'Revised Uniform Act of 30 January 2014 (applies directly)', regulator: 'Registre du Commerce et du Crédit Mobilier', source: O('https://www.ohada.org/'), extra: 'Applies directly in all OHADA states, alongside national trade register rules.' }),
  syscohada: (j: string) => T.accounting(j, { title: 'OHADA Uniform Act on Accounting Law and Financial Reporting (SYSCOHADA)', citation: 'Uniform Act of 26 January 2017', regulator: 'OHADA', source: O('https://www.ohada.org/'), extra: 'Listed and public-offer entities also prepare IFRS statements; non-profits use SYCEBNL.' }),
  waemuBank: (j: string) => T.bank(j, { title: 'WAMU banking law and BCEAO prudential framework', citation: 'Uniform banking regulation law, transposed nationally', regulator: 'the BCEAO and the WAMU Banking Commission', source: O('https://www.bceao.int/') }),
  waemuGov: (j: string) => T.govNone(j, { title: 'No national corporate governance code', citation: 'OHADA company law; BCEAO governance circulars for banks; AMF-UMOA rules for listed issuers', regulator: 'BCEAO; AMF-UMOA', source: O('https://www.bceao.int/') }),
  waemuAml: (j: string) => T.aml(j, { title: 'Uniform law on combating money laundering, terrorist financing and proliferation financing', citation: 'National transposition of the WAEMU AML/CFT directive', regulator: 'the national CENTIF (financial intelligence unit)', source: O('https://www.giaba.org/') }),
  waemuCapital: (j: string) => T.securities(j, { title: 'WAMU regional financial market framework', citation: 'AMF-UMOA General Regulation; BRVM rules', regulator: 'AMF-UMOA, with listing on the BRVM', source: O('https://www.amf-umoa.org/') }),
  cemacBank: (j: string) => T.bank(j, { title: 'CEMAC banking regulation', citation: 'COBAC prudential regulations', regulator: 'the BEAC and COBAC (Central African Banking Commission)', source: O('https://www.beac.int/') }),
  cemacAml: (j: string) => T.aml(j, { title: 'CEMAC Regulation on the prevention and suppression of money laundering and terrorist financing', citation: 'CEMAC regulation of 2016 (applies directly)', regulator: 'the national ANIF (financial intelligence agency)', source: O('https://www.beac.int/') }),
  cemacCapital: (j: string) => T.securities(j, { title: 'CEMAC unified regional financial market', citation: 'COSUMAF General Regulation; BVMAC rules', regulator: 'COSUMAF, with listing on the BVMAC', source: O('https://www.bvm-ac.org/') }),
  waemuCompetition: (j: string) => T.competition(j, { title: 'WAEMU community competition rules', citation: 'WAEMU competition regulations (regional; the WAEMU Commission has exclusive competence)', regulator: 'the WAEMU Commission', source: O('https://www.uemoa.int/') }),
  waemuForex: (j: string) => T.forex(j, { title: 'WAEMU regulation on the external financial relations of member states', citation: 'Regulation No. 09/2010/CM/UEMOA (regional)', regulator: 'the BCEAO and authorised banks', source: O('https://www.bceao.int/') }),
  cemacCompetition: (j: string) => T.competition(j, { title: 'CEMAC competition regulation', citation: 'CEMAC regulation of 2019 (regional)', regulator: 'the CEMAC Competition Council', source: O('https://www.cemac.int/') }),
  cemacForex: (j: string) => T.forex(j, { title: 'CEMAC foreign exchange regulation', citation: 'CEMAC exchange regulation of 2018 (regional), with BEAC instructions', regulator: 'the BEAC and authorised banks', source: O('https://www.beac.int/'), extra: 'Repatriation of export earnings and documentation of transfers abroad are closely enforced.' }),
  cemacGov: (j: string) => T.govNone(j, { title: 'No national corporate governance code', citation: 'OHADA company law; COBAC governance rules for banks; COSUMAF rules for listed issuers', regulator: 'COBAC; COSUMAF', source: O('https://www.beac.int/') }),
}

/** Give each entry its id `${J}-${area}-${n}`, numbering within jurisdiction and area. */
export function finalize(entries: LawEntry[], after: LawEntry[] = []): LawEntry[] {
  const n = new Map<string, number>()
  // Continue numbering after entries that already exist for the same jurisdiction and area.
  for (const e of after) n.set(`${e.jurisdiction}-${e.area}`, (n.get(`${e.jurisdiction}-${e.area}`) ?? 0) + 1)
  return entries.map((e) => {
    const k = `${e.jurisdiction}-${e.area}`
    n.set(k, (n.get(k) ?? 0) + 1)
    return { ...e, id: `${k}-${n.get(k)}` }
  })
}
