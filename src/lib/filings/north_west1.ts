// Egypt, Morocco and Senegal: recurring statutory filings, checked 19 October 2026.
// Not yet included (sources conflict): Egypt payroll tax and social insurance dates; Morocco CNSS date.
import type { StatutoryFiling } from './index.ts'

const C = '2026-10-19'
const O = (url: string) => ({ url, kind: 'official' as const, checked: C })
const S = (url: string) => ({ url, kind: 'secondary' as const, checked: C })
const MA_CAL = 'https://www.upsilon-consulting.com/calendrier-fiscal-maroc-2026/'
const SN_CAL = 'https://ayitechsn.com/blog-calendrier-fiscal.html'

export const NW1_FILINGS: StatutoryFiling[] = [
  // ---- Egypt ----
  {
    id: 'eg-cit', jurisdiction: 'EG', name: 'Corporate income tax return', authority: 'Egyptian Tax Authority (ETA)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 4 },
    dueText: 'Within four months after the year end (30 April for a December year end), filed electronically.',
    legalBasis: 'Income Tax Law No. 91 of 2005; Unified Tax Procedures Law No. 206 of 2020',
    source: S('https://www.dailynewsegypt.com/2025/04/12/corporate-tax-filing-deadline-remains-30-april-eta-chief/'),
  },
  {
    id: 'eg-vat', jurisdiction: 'EG', name: 'VAT return and payment', authority: 'Egyptian Tax Authority (ETA)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 31 },
    dueText: 'Monthly, within one month after the end of the tax period.', legalBasis: 'Value Added Tax Law No. 67 of 2016',
    notes: 'One guide gives the 15th of the following month, and simplified-regime taxpayers may differ; confirm with the ETA.',
    source: S('https://www.wafeq.com/en-eg/tax-and-reporting/electronic-tax-returns'),
  },
  // ---- Morocco ----
  {
    id: 'ma-is-acomptes', jurisdiction: 'MA', name: 'Corporate tax instalments (acomptes IS)', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['company'], due: { kind: 'instalments', months: [3, 6, 9, 12], day: 31 },
    dueText: 'Four instalments of 25% of the previous year\'s tax, before the end of the 3rd, 6th, 9th and 12th months of the financial year.',
    legalBasis: 'Code Général des Impôts, article 170', source: S(MA_CAL),
  },
  {
    id: 'ma-is-return', jurisdiction: 'MA', name: 'Corporate tax return (IS)', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 3 },
    dueText: 'Within three months after the year end.', legalBasis: 'Code Général des Impôts', source: S(MA_CAL),
  },
  {
    id: 'ma-tva', jurisdiction: 'MA', name: 'VAT return (monthly regime)', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 20 },
    dueText: 'Monthly regime (turnover of MAD 1 million or more): e-filing and payment by the 20th of the following month; smaller businesses file quarterly.',
    legalBasis: 'Code Général des Impôts', notes: 'Some sources say e-filing can run to the end of the month; confirm with the DGI.', source: S(MA_CAL),
  },
  {
    id: 'ma-ir-salaires', jurisdiction: 'MA', name: 'Income tax withheld on salaries (IR)', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 31 },
    dueText: 'Paid within the month after the salaries are paid.', legalBasis: 'Code Général des Impôts, article 174',
    notes: 'Some calendars give the 20th of the following month.', source: S('https://www.wadifa-info.com/fr/calendrier-fiscal-maroc'),
  },
  {
    id: 'ma-9421', jurisdiction: 'MA', name: 'Annual salary declaration (état 9421)', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['employer'], due: { kind: 'annual-fixed', month: 2, day: 28 },
    dueText: 'Before 1 March for the previous year.', legalBasis: 'Code Général des Impôts, article 79', source: S('https://www.wadifa-info.com/fr/calendrier-fiscal-maroc'),
  },
  // ---- Senegal ----
  {
    id: 'sn-monthly', jurisdiction: 'SN', name: 'Monthly VAT and withholding declarations (TVA, VRS, BRS)', authority: 'Direction Générale des Impôts et des Domaines (DGID)',
    appliesTo: ['employer', 'vat-registered', 'company', 'ngo'], due: { kind: 'monthly', day: 15 },
    dueText: 'VAT, tax withheld on salaries and on payments and rents, declared and paid by the 15th of the following month.',
    legalBasis: 'Code Général des Impôts (Law No. 2012-31, as amended)', source: O('https://www.dgid.sn/'),
  },
  {
    id: 'sn-social', jurisdiction: 'SN', name: 'IPRES (pension) and CSS (social security) contributions', authority: 'IPRES; Caisse de Sécurité Sociale (CSS)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 15 },
    dueText: 'By the 15th of the following month.', legalBasis: 'Social security code and IPRES rules',
    notes: 'An older calendar gives the 10th; confirm with IPRES and the CSS.', source: S('https://vifworkforce.com/articles/cotisations-fiscales-et-sociales-des-salaries-au-senegal-le-guide-complet-2025'),
  },
  {
    id: 'sn-is-return', jurisdiction: 'SN', name: 'Corporate tax return and financial statements', authority: 'Direction Générale des Impôts et des Domaines (DGID)',
    appliesTo: ['company'], due: { kind: 'annual-fixed', month: 4, day: 30 },
    dueText: 'By 30 April: tax return and financial statements filed on the SEN ETAFI platform (calendar-year companies).', legalBasis: 'Code Général des Impôts', source: S(SN_CAL),
  },
  {
    id: 'sn-is-acomptes', jurisdiction: 'SN', name: 'Corporate tax instalments and balance', authority: 'Direction Générale des Impôts et des Domaines (DGID)',
    appliesTo: ['company'], due: { kind: 'semi-annual-fixed', dates: [{ month: 2, day: 15 }, { month: 4, day: 30 }] },
    dueText: 'Instalments by 15 February and 30 April; the balance is due by 15 June.', legalBasis: 'Code Général des Impôts', source: S(SN_CAL),
  },
]
