// Ethiopia and Madagascar: recurring statutory filings, checked 19 October 2026.
// Not yet included: Ethiopia PAYE and pension date (PwC says within 30 days after the month; other guides say the 8th)
// and VAT date; Madagascar CNaPS and OSTIE dates. No usable sources yet for Comoros or Djibouti.
import type { StatutoryFiling } from './index.ts'

const C = '2026-10-19'
const O = (url: string) => ({ url, kind: 'official' as const, checked: C })
const S = (url: string) => ({ url, kind: 'secondary' as const, checked: C })
const ET_PWC = 'https://taxsummaries.pwc.com/ethiopia/corporate/tax-administration'
const MG_PWC = 'https://taxsummaries.pwc.com/madagascar/corporate/tax-administration'

export const EAST2_FILINGS: StatutoryFiling[] = [
  // ---- Ethiopia ----
  {
    id: 'et-cit', jurisdiction: 'ET', name: 'Corporate income tax return and payment', authority: 'Ministry of Revenues (MoR)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 4 },
    dueText: 'Self-assessment return, tax computation and financial statements by the last day of the fourth month after the tax year end (the Ethiopian tax year ends on 7 July).',
    legalBasis: 'Income Tax Proclamation No. 979/2016; Tax Administration Proclamation No. 983/2016', source: S(ET_PWC),
  },
  {
    id: 'et-advance', jurisdiction: 'ET', name: 'Advance corporate tax payments', authority: 'Ministry of Revenues (MoR)',
    appliesTo: ['company'], due: { kind: 'event', text: 'quarterly, 25% of the previous year\'s tax' },
    dueText: 'Each quarter, 25% of the previous year\'s tax liability, after the return due date.',
    legalBasis: 'Income Tax Proclamation No. 979/2016, as amended', notes: 'Confirm the quarterly dates and turnover threshold with the MoR.', source: S(ET_PWC),
  },
  // ---- Madagascar ----
  {
    id: 'mg-is', jurisdiction: 'MG', name: 'Corporate income tax (IS) return and balance', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['company'], due: { kind: 'annual-fixed', month: 5, day: 15 },
    dueText: 'Before 15 May for a 31 December year end (before 15 November for 30 June); bimonthly provisional instalments during the year.',
    legalBasis: 'Code Général des Impôts', notes: 'A 2015 DGI note gave 31 March; current guides give 15 May.', source: S(MG_PWC),
  },
  {
    id: 'mg-tva', jurisdiction: 'MG', name: 'VAT return (TVA)', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 15 },
    dueText: 'Monthly, before the 15th of the following month.', legalBasis: 'Code Général des Impôts', source: S('https://manao.mg/fr/declaration-mensuelle-tva'),
  },
  {
    id: 'mg-irsa', jurisdiction: 'MG', name: 'Tax withheld on salaries (IRSA)', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 15 },
    dueText: 'Within the first 15 days of the following month.', legalBasis: 'Code Général des Impôts',
    source: O('https://torolalana.gov.mg/fr/services/les-differents-types-d-impots-a-madagascar/'),
  },
  {
    id: 'mg-wht', jurisdiction: 'MG', name: 'Withholding taxes', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['company', 'ngo'], due: { kind: 'monthly', day: 15 },
    dueText: 'Tax withheld on foreign services, unregistered suppliers, interest, directors\' fees and dividends: before the 15th of the following month.',
    legalBasis: 'Code Général des Impôts', source: S(MG_PWC),
  },
]
