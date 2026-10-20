// Ghana: recurring statutory filings, checked 19 October 2026. VAT Act 2025 (Act 1151) in force from 1 January 2026.
import type { StatutoryFiling } from './index.ts'

const C = '2026-10-19'
const O = (url: string) => ({ url, kind: 'official' as const, checked: C })
const S = (url: string) => ({ url, kind: 'secondary' as const, checked: C })
const GUIDE = 'https://firmusadvisory.com/taxes-in-ghana-all-you-need-to-know/'

export const GH_FILINGS: StatutoryFiling[] = [
  {
    id: 'gh-orc-annual-return', jurisdiction: 'GH', name: 'Registrar of Companies annual return', authority: 'Office of the Registrar of Companies (ORC)',
    appliesTo: ['company', 'ngo', 'business-name'], due: { kind: 'annual-after-year-end', months: 4 },
    dueText: 'Annual return (or business name renewal) each year; for a 31 December year end the ORC deadline is 30 April.',
    legalBasis: 'Companies Act 2019 (Act 992), section 126', notes: 'Penalties rise with years in default, and defaulting companies can be struck off (section 289).',
    source: O('https://orc.gov.gh/'),
  },
  {
    id: 'gh-cit', jurisdiction: 'GH', name: 'Corporate income tax return', authority: 'Ghana Revenue Authority (GRA)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 4 },
    dueText: 'Within four months after the end of the basis period (year end).', legalBasis: 'Income Tax Act 2015 (Act 896); Revenue Administration Act 2016 (Act 915)', source: S(GUIDE),
  },
  {
    id: 'gh-vat', jurisdiction: 'GH', name: 'VAT return and payment', authority: 'Ghana Revenue Authority (GRA)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 31 },
    dueText: 'Monthly, by the last working day of the following month.', legalBasis: 'Value Added Tax Act 2025 (Act 1151)', source: S(GUIDE),
  },
  {
    id: 'gh-paye-wht', jurisdiction: 'GH', name: 'PAYE and withholding tax remittance', authority: 'Ghana Revenue Authority (GRA)',
    appliesTo: ['employer', 'company', 'ngo'], due: { kind: 'monthly', day: 15 },
    dueText: 'Monthly, by the 15th day of the following month.', legalBasis: 'Income Tax Act 2015 (Act 896)', source: S(GUIDE),
  },
  {
    id: 'gh-paye-annual', jurisdiction: 'GH', name: 'Employer annual PAYE return', authority: 'Ghana Revenue Authority (GRA)',
    appliesTo: ['employer'], due: { kind: 'annual-fixed', month: 4, day: 30 },
    dueText: 'By 30 April for the previous year.', legalBasis: 'Income Tax Act 2015 (Act 896)', source: S('https://seamlesshr.com/blog/payroll-in-ghana/'),
  },
  {
    id: 'gh-ssnit', jurisdiction: 'GH', name: 'SSNIT (Tier 1) and Tier 2 pension contributions', authority: 'Social Security and National Insurance Trust (SSNIT); Tier 2 trustees',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 14 },
    dueText: 'By the 14th day of the following month; late payment attracts 3% a month.', legalBasis: 'National Pensions Act 2008 (Act 766)', source: O('https://www.ssnit.org.gh/'),
  },
]
