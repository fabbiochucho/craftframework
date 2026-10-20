// United Kingdom, United States and Seychelles: recurring statutory filings, checked 19 October 2026.
// US entries are federal only; state filings (annual reports, state income and sales tax) vary by state and are not listed.
// US entities created in the United States are exempt from FinCEN beneficial ownership reporting (interim final rule, March 2025).
import type { StatutoryFiling } from './index.ts'

const C = '2026-10-19'
const O = (url: string) => ({ url, kind: 'official' as const, checked: C })

export const OTHER_FILINGS: StatutoryFiling[] = [
  // ---- United Kingdom ----
  {
    id: 'uk-confirmation', jurisdiction: 'UK', name: 'Companies House confirmation statement', authority: 'Companies House',
    appliesTo: ['company'], due: { kind: 'event', text: 'within 14 days after each review period' },
    dueText: 'At least once a year, up to 14 days after the end of the review period (fines up to £5,000 and possible strike-off).',
    legalBasis: 'Companies Act 2006, Part 24', source: O('https://www.gov.uk/guidance/confirmation-statement-guidance'),
  },
  {
    id: 'uk-accounts', jurisdiction: 'UK', name: 'Annual accounts to Companies House', authority: 'Companies House',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 9 },
    dueText: 'Private companies within 9 months after the accounting reference date (public companies 6 months).',
    legalBasis: 'Companies Act 2006, section 442', source: O('https://www.gov.uk/government/publications/life-of-a-company-annual-requirements/life-of-a-company-part-1-accounts'),
  },
  {
    id: 'uk-ct-pay', jurisdiction: 'UK', name: 'Corporation Tax payment', authority: 'HM Revenue and Customs (HMRC)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 9 },
    dueText: '9 months and 1 day after the end of the accounting period (taxable profits over £1.5 million: quarterly instalments).',
    legalBasis: 'Corporation Tax Act 2009; Taxes Management Act 1970', source: O('https://www.gov.uk/pay-corporation-tax'),
  },
  {
    id: 'uk-ct600', jurisdiction: 'UK', name: 'Company Tax Return (CT600)', authority: 'HM Revenue and Customs (HMRC)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 12 },
    dueText: '12 months after the end of the accounting period.', legalBasis: 'Finance Act 1998, Schedule 18', source: O('https://www.gov.uk/company-tax-returns'),
  },
  {
    id: 'uk-vat', jurisdiction: 'UK', name: 'VAT Return and payment', authority: 'HM Revenue and Customs (HMRC)',
    appliesTo: ['vat-registered'], due: { kind: 'event', text: 'one calendar month and 7 days after each VAT period' },
    dueText: 'Usually one calendar month and 7 days after the end of each VAT accounting period (usually quarterly), even with nothing to pay.',
    legalBasis: 'Value Added Tax Act 1994', source: O('https://www.gov.uk/submit-vat-return'),
  },
  {
    id: 'uk-paye', jurisdiction: 'UK', name: 'PAYE: Full Payment Submission and payment', authority: 'HM Revenue and Customs (HMRC)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 22 },
    dueText: 'FPS on or before each payday; payment by the 22nd of the next tax month (19th by cheque).',
    legalBasis: 'Income Tax (Pay As You Earn) Regulations 2003', source: O('https://www.gov.uk/pay-paye-tax'),
  },
  {
    id: 'uk-charity-return', jurisdiction: 'UK', name: 'Charity annual return (England and Wales)', authority: 'Charity Commission',
    appliesTo: ['ngo'], due: { kind: 'annual-after-year-end', months: 10 },
    dueText: 'Within 10 months of the financial year end.', legalBasis: 'Charities Act 2011',
    notes: 'Scotland (OSCR) and Northern Ireland (CCNI) have their own regulators.', source: O('https://www.gov.uk/guidance/prepare-a-charity-annual-return'),
  },
  // ---- United States (federal) ----
  {
    id: 'us-1120', jurisdiction: 'US', name: 'Corporate income tax return (Form 1120)', authority: 'Internal Revenue Service (IRS)',
    appliesTo: ['company'], due: { kind: 'annual-fixed', month: 4, day: 15 },
    dueText: 'By the 15th day of the 4th month after the tax year end (15 April for calendar-year corporations).',
    legalBasis: 'Internal Revenue Code, section 6072', notes: 'The date shown assumes a calendar year.', source: O('https://www.irs.gov/instructions/i1120'),
  },
  {
    id: 'us-990', jurisdiction: 'US', name: 'Exempt organisation return (Form 990, 990-EZ or 990-PF)', authority: 'Internal Revenue Service (IRS)',
    appliesTo: ['ngo'], due: { kind: 'annual-fixed', month: 5, day: 15 },
    dueText: 'By the 15th day of the 5th month after the year end (15 May for a calendar year); a 6-month extension is available on Form 8868.',
    legalBasis: 'Internal Revenue Code, section 6033', notes: 'The date shown assumes a calendar year.', source: O('https://www.irs.gov/charities-non-profits/annual-exempt-organization-return-due-date'),
  },
  {
    id: 'us-941', jurisdiction: 'US', name: 'Employer\'s quarterly federal tax return (Form 941)', authority: 'Internal Revenue Service (IRS)',
    appliesTo: ['employer'], due: { kind: 'fixed-dates', dates: [{ month: 1, day: 31 }, { month: 4, day: 30 }, { month: 7, day: 31 }, { month: 10, day: 31 }] },
    dueText: 'By the last day of the month after each quarter; tax deposits are separate (monthly or semiweekly).',
    legalBasis: 'Internal Revenue Code, sections 3102, 3402 and 6011', source: O('https://www.irs.gov/instructions/i941'),
  },
  // ---- Seychelles ----
  {
    id: 'sc-monthly', jurisdiction: 'SC', name: 'Income tax withheld (PAYG) and VAT returns', authority: 'Seychelles Revenue Commission (SRC)',
    appliesTo: ['employer', 'vat-registered'], due: { kind: 'monthly', day: 21 },
    dueText: 'By the 21st of the following month (voluntary VAT registrants: the 21st after each quarter).', legalBasis: 'Income and Non-Monetary Benefits Tax Act; Value Added Tax Act 2010',
    source: O('https://src.gov.sc/faq/'),
  },
  {
    id: 'sc-business-tax', jurisdiction: 'SC', name: 'Business tax return', authority: 'Seychelles Revenue Commission (SRC)',
    appliesTo: ['company'], due: { kind: 'annual-fixed', month: 3, day: 31 },
    dueText: 'By 31 March of the following year, whether or not tax is due.', legalBasis: 'Business Tax Act 2009', source: O('https://src.gov.sc/faq/'),
  },
]
