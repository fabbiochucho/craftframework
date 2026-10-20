// Uganda, Tanzania and Rwanda: recurring statutory filings, checked 19 October 2026.
// Not yet included (no confirmed deadline found): URSB and BRELA annual returns, the Rwanda RDB annual return.
import type { StatutoryFiling } from './index.ts'

const C = '2026-10-19'
const O = (url: string) => ({ url, kind: 'official' as const, checked: C })
const S = (url: string) => ({ url, kind: 'secondary' as const, checked: C })
const URA = 'https://ura.go.ug/en/domestic-taxes/returns/'
const TZ_GUIDE = 'https://www.rsm.global/tanzania/sites/default/files/media/documents/RSMTZ_Tanzania%20Tax%20Guide%202025-26.pdf'
const RW_GUIDE = 'https://auxiliaconsultant.com/2026/03/20/rra-filing-deadlines-2025/'

export const EAST_FILINGS: StatutoryFiling[] = [
  // ---- Uganda ----
  {
    id: 'ug-monthly', jurisdiction: 'UG', name: 'Monthly VAT, PAYE and withholding tax returns', authority: 'Uganda Revenue Authority (URA)',
    appliesTo: ['employer', 'vat-registered', 'company', 'ngo'], due: { kind: 'monthly', day: 15 },
    dueText: 'VAT, PAYE, withholding tax and local excise duty returns by the 15th day of the month after the return period.',
    legalBasis: 'Tax Procedures Code Act 2014; Income Tax Act (Cap. 338); Value Added Tax Act', source: O(URA),
  },
  {
    id: 'ug-income-tax', jurisdiction: 'UG', name: 'Annual income tax return', authority: 'Uganda Revenue Authority (URA)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 6 },
    dueText: 'Within six months after the end of the financial period (31 December for a 30 June year end).', legalBasis: 'Income Tax Act (Cap. 338); Tax Procedures Code Act 2014', source: O(URA),
  },
  {
    id: 'ug-provisional', jurisdiction: 'UG', name: 'Provisional income tax', authority: 'Uganda Revenue Authority (URA)',
    appliesTo: ['company'], due: { kind: 'instalments', months: [6, 12], day: 31 },
    dueText: 'Provisional return and first instalment within the first six months of the accounting year; second by the end of the 12th month.',
    legalBasis: 'Income Tax Act (Cap. 338)', source: S('https://senteguide.com/calendars/tax'),
  },
  {
    id: 'ug-nssf', jurisdiction: 'UG', name: 'NSSF contributions', authority: 'National Social Security Fund (NSSF Uganda)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 15 },
    dueText: 'Employer and employee contributions by the 15th of the following month.', legalBasis: 'National Social Security Fund Act', source: S('https://senteguide.com/calendars/tax'),
  },
  // ---- Tanzania ----
  {
    id: 'tz-paye-sdl-wht', jurisdiction: 'TZ', name: 'PAYE, Skills Development Levy and withholding tax', authority: 'Tanzania Revenue Authority (TRA)',
    appliesTo: ['employer', 'company', 'ngo'], due: { kind: 'monthly', day: 7 },
    dueText: 'By the 7th day of the following month.', legalBasis: 'Income Tax Act (Cap. 332); Vocational Education and Training Act (SDL); Tax Administration Act', source: S(TZ_GUIDE),
  },
  {
    id: 'tz-vat', jurisdiction: 'TZ', name: 'VAT return and payment', authority: 'Tanzania Revenue Authority (TRA)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 20 },
    dueText: 'Monthly, by the 20th day of the following month.', legalBasis: 'Value Added Tax Act (Cap. 148)',
    notes: 'One guide gives the 25th, and the Finance Act 2026 tightened some VAT windows; confirm with TRA.', source: S(TZ_GUIDE),
  },
  {
    id: 'tz-instalments', jurisdiction: 'TZ', name: 'Corporate income tax instalments', authority: 'Tanzania Revenue Authority (TRA)',
    appliesTo: ['company'], due: { kind: 'instalments', months: [3, 6, 9, 12], day: 31 },
    dueText: 'Four quarterly instalments, by the end of the 3rd, 6th, 9th and 12th months of the year of income.', legalBasis: 'Income Tax Act (Cap. 332)', source: S(TZ_GUIDE),
  },
  {
    id: 'tz-cit', jurisdiction: 'TZ', name: 'Corporate income tax return', authority: 'Tanzania Revenue Authority (TRA)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 6 },
    dueText: 'Final return within six months after the year end.', legalBasis: 'Income Tax Act (Cap. 332); Tax Administration Act', source: S(TZ_GUIDE),
  },
  {
    id: 'tz-nssf-wcf', jurisdiction: 'TZ', name: 'NSSF and Workers Compensation Fund contributions', authority: 'NSSF Tanzania; Workers Compensation Fund (WCF)',
    appliesTo: ['employer'], due: { kind: 'event', text: 'monthly, after each payroll' },
    dueText: 'Monthly pension (NSSF) and workers\' compensation (WCF) contributions.', legalBasis: 'National Social Security Fund Act; Workers Compensation Act',
    notes: 'Sources differ on the date (most say the end of the following month, one says the 10th); confirm with NSSF and WCF.', source: O('https://www.nssf.go.tz/'),
  },
  // ---- Rwanda ----
  {
    id: 'rw-monthly', jurisdiction: 'RW', name: 'Monthly VAT, PAYE, withholding tax and RSSB declarations', authority: 'Rwanda Revenue Authority (RRA); Rwanda Social Security Board (RSSB)',
    appliesTo: ['employer', 'vat-registered', 'company', 'ngo'], due: { kind: 'monthly', day: 15 },
    dueText: 'By the 15th day of the following month (smaller VAT payers may declare quarterly).',
    legalBasis: 'Law No. 049/2023 on VAT; Law No. 027/2022 on income taxes; tax procedures law', source: S(RW_GUIDE),
  },
  {
    id: 'rw-cit', jurisdiction: 'RW', name: 'Corporate income tax return', authority: 'Rwanda Revenue Authority (RRA)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 3 },
    dueText: 'Return and final payment by 31 March for a December year end.', legalBasis: 'Law No. 027/2022 on income taxes', source: S(RW_GUIDE),
  },
  {
    id: 'rw-prepayment', jurisdiction: 'RW', name: 'Quarterly advance income tax payments', authority: 'Rwanda Revenue Authority (RRA)',
    appliesTo: ['company'], due: { kind: 'instalments', months: [6, 9, 12], day: 30 },
    dueText: 'Advance payments due in June, September and December for a calendar year.', legalBasis: 'Law No. 027/2022 on income taxes',
    notes: 'Confirm exact dates with RRA.', source: S('https://sokrab.com/corporate-income-tax-rwanda/'),
  },
]
