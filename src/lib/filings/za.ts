// South Africa: recurring statutory filings, checked 19 October 2026.
import type { StatutoryFiling } from './index.ts'

const C = '2026-10-19'
const O = (url: string) => ({ url, kind: 'official' as const, checked: C })
const S = (url: string) => ({ url, kind: 'secondary' as const, checked: C })
const SARS_CAL = 'https://www.bekinconsulting.co.za/sars-2026-deadlines/'

export const ZA_FILINGS: StatutoryFiling[] = [
  {
    id: 'za-cipc-annual-return', jurisdiction: 'ZA', name: 'CIPC annual return', authority: 'Companies and Intellectual Property Commission (CIPC)',
    appliesTo: ['company', 'ngo'], due: { kind: 'event', text: 'within 30 business days after each anniversary of incorporation' },
    dueText: 'Every company, including non-profit companies (NPCs), files within 30 business days after the anniversary of incorporation.',
    legalBasis: 'Companies Act 71 of 2008, section 33(1)', notes: 'Persistent non-filing leads to deregistration.',
    source: S('https://www.clearcomply.co.za/blog/cipc-annual-returns-south-africa'),
  },
  {
    id: 'za-itr14', jurisdiction: 'ZA', name: 'Company income tax return (ITR14)', authority: 'South African Revenue Service (SARS)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 12 },
    dueText: 'Within 12 months after the financial year end.', legalBasis: 'Income Tax Act 58 of 1962; Tax Administration Act 28 of 2011', source: S(SARS_CAL),
  },
  {
    id: 'za-irp6', jurisdiction: 'ZA', name: 'Provisional tax (IRP6)', authority: 'South African Revenue Service (SARS)',
    appliesTo: ['company'], due: { kind: 'instalments', months: [6, 12], day: 31 },
    dueText: 'First payment at the end of the 6th month of the year of assessment and second at year end; an optional top-up follows.',
    legalBasis: 'Income Tax Act 58 of 1962, Fourth Schedule', notes: 'A late return attracts a 10% penalty plus interest; underestimating by more than 10% can add a 20% penalty.',
    source: S(SARS_CAL),
  },
  {
    id: 'za-vat201', jurisdiction: 'ZA', name: 'VAT return (VAT201) and payment', authority: 'South African Revenue Service (SARS)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 25 },
    dueText: 'By the 25th day after the end of each VAT period, or the last business day of that month if filed and paid on eFiling.',
    legalBasis: 'Value-Added Tax Act 89 of 1991', notes: 'Most vendors file every two months (Category A or B); the date applies after the end of your VAT period.',
    source: S(SARS_CAL),
  },
  {
    id: 'za-emp201', jurisdiction: 'ZA', name: 'Monthly employer declaration (EMP201: PAYE, UIF, SDL)', authority: 'South African Revenue Service (SARS)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 7 },
    dueText: 'By the 7th of the following month (the last business day before, if the 7th is not a business day).',
    legalBasis: 'Income Tax Act 58 of 1962, Fourth Schedule; Unemployment Insurance Contributions Act; Skills Development Levies Act', source: S(SARS_CAL),
  },
  {
    id: 'za-emp501', jurisdiction: 'ZA', name: 'Employer reconciliation (EMP501)', authority: 'South African Revenue Service (SARS)',
    appliesTo: ['employer'], due: { kind: 'semi-annual-fixed', dates: [{ month: 5, day: 31 }, { month: 10, day: 31 }] },
    dueText: 'Annual reconciliation by 31 May and interim reconciliation by 31 October, with employees\' tax certificates.',
    legalBasis: 'Income Tax Act 58 of 1962, Fourth Schedule', source: S(SARS_CAL),
  },
  {
    id: 'za-npo-report', jurisdiction: 'ZA', name: 'NPO annual report (registered NPOs)', authority: 'Department of Social Development, NPO Directorate',
    appliesTo: ['ngo'], due: { kind: 'event', text: 'within the prescribed period after each financial year' },
    dueText: 'A narrative report, financial statements and an accounting officer\'s report each year, if registered under the Nonprofit Organisations Act.',
    legalBasis: 'Nonprofit Organisations Act 71 of 1997', notes: 'Not reporting can lead to deregistration; confirm the current deadline with the Directorate.',
    source: O('https://www.dsd.gov.za/'),
  },
]
