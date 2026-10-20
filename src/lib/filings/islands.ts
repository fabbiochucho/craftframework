// Mauritius and Cabo Verde: recurring statutory filings, checked 19 October 2026.
// Not yet included (unconfirmed): Mauritius Registrar of Companies annual return; Cabo Verde INPS contribution date.
import type { StatutoryFiling } from './index.ts'

const C = '2026-10-19'
const O = (url: string) => ({ url, kind: 'official' as const, checked: C })
const S = (url: string) => ({ url, kind: 'secondary' as const, checked: C })
const CV_CAL = 'https://www.mf.gov.cv/documents/54571/0/Calendario_Fiscal_2026_PEC_Vers%C3%A3o_Atualizado_110626.pdf/7f524ec2-1b35-2f33-8936-42e8b752516e?version=1.0&t=1781260657225'

export const ISLAND_FILINGS: StatutoryFiling[] = [
  // ---- Mauritius ----
  {
    id: 'mu-cit', jurisdiction: 'MU', name: 'Corporate income tax return', authority: 'Mauritius Revenue Authority (MRA)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 6 },
    dueText: 'Not later than six months from the end of the month in which the accounting year ends (for June and December year ends, two working days before the end of December and June).',
    legalBasis: 'Income Tax Act 1995', source: O('https://www.mra.mu/taxes-duties/corporate-taxation'),
  },
  {
    id: 'mu-aps', jurisdiction: 'MU', name: 'Advance Payment System (APS) statements', authority: 'Mauritius Revenue Authority (MRA)',
    appliesTo: ['company'], due: { kind: 'event', text: 'quarterly' },
    dueText: 'Quarterly statements and payments for companies with turnover of Rs 10 million or more.', legalBasis: 'Income Tax Act 1995',
    notes: 'Confirm the quarterly deadline with the MRA.', source: O('https://www.mra.mu/taxes-duties/corporate-taxation'),
  },
  {
    id: 'mu-vat', jurisdiction: 'MU', name: 'VAT return and payment', authority: 'Mauritius Revenue Authority (MRA)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 31 },
    dueText: 'Monthly returns by the end of the following month (quarterly filers: by the end of the month after the quarter); late returns cost Rs 2,000 a month, up to Rs 20,000.',
    legalBasis: 'Value Added Tax Act 1998', source: O('https://www.mra.mu/eservices1/vat-eservices/vat-return'),
  },
  {
    id: 'mu-paye', jurisdiction: 'MU', name: 'PAYE, CSG and NSF return (employers)', authority: 'Mauritius Revenue Authority (MRA)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 20 },
    dueText: 'Monthly joint return and payment of PAYE, Contribution Sociale Généralisée and National Solidarity Fund contributions.',
    legalBasis: 'Income Tax Act 1995; Social Contribution and Benefits Act 2021',
    notes: 'Sources give the 20th or the end of the following month; the earlier date is shown. Confirm with the MRA calendar.', source: S('https://filing.mu/'),
  },
  // ---- Cabo Verde ----
  {
    id: 'cv-iva', jurisdiction: 'CV', name: 'VAT return (Modelo 106) and payment', authority: 'Direção Nacional de Receitas do Estado (DNRE)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 31 },
    dueText: 'Monthly, filed and paid electronically by the end of the following month, even with no taxable operations.',
    legalBasis: 'Código do IVA', source: O(CV_CAL),
  },
  {
    id: 'cv-irpc', jurisdiction: 'CV', name: 'Corporate income tax return (IRPC, Modelo 1B)', authority: 'Direção Nacional de Receitas do Estado (DNRE)',
    appliesTo: ['company'], due: { kind: 'annual-fixed', month: 5, day: 31 },
    dueText: 'By the last day of May for the previous year.', legalBasis: 'Código do IRPC (Lei n.º 82/VIII/2015)', source: O(CV_CAL),
  },
  {
    id: 'cv-withholding', jurisdiction: 'CV', name: 'Tax withheld (IRPS and IRPC) remittance', authority: 'Direção Nacional de Receitas do Estado (DNRE)',
    appliesTo: ['employer', 'company', 'ngo'], due: { kind: 'monthly', day: 15 },
    dueText: 'Tax withheld is paid by the 15th of the following month.', legalBasis: 'Códigos do IRPS e do IRPC',
    notes: 'From a consultancy guide; confirm against the official calendar.', source: S('https://consultoria.cv/en/irpc-deadline-in-cape-verde-a-comprehensive-guide-for-2026/'),
  },
]
