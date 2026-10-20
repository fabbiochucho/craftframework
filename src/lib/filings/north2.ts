// Algeria, Tunisia, Libya and Mauritania: recurring statutory filings, checked 19 October 2026.
// Not yet included (sources conflict): Tunisia annual IS return date and CNSS periodicity; Algeria CNAS annual DAS date.
import type { StatutoryFiling } from './index.ts'

const C = '2026-10-19'
const O = (url: string) => ({ url, kind: 'official' as const, checked: C })
const S = (url: string) => ({ url, kind: 'secondary' as const, checked: C })
const DZ_CAL = 'https://qompta.com/guides/calendrier-fiscal-algerie-2026'
const TN_CAL = 'https://www.bfc.com.tn/calendrier-fiscal-2026-tunisie'

export const NORTH2_FILINGS: StatutoryFiling[] = [
  // ---- Algeria ----
  {
    id: 'dz-g50', jurisdiction: 'DZ', name: 'Monthly G50 return (VAT, IRG on salaries, IBS instalments)', authority: 'Direction Générale des Impôts (DGI), via Jibayatic',
    appliesTo: ['company', 'employer', 'vat-registered'], due: { kind: 'monthly', day: 20 },
    dueText: 'By the 20th of the following month.', legalBasis: 'Code des impôts directs et taxes assimilées; Code des taxes sur le chiffre d\'affaires', source: S(DZ_CAL),
  },
  {
    id: 'dz-ibs-return', jurisdiction: 'DZ', name: 'Annual IBS return, balance sheet and tax package (liasse fiscale)', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['company'], due: { kind: 'annual-fixed', month: 4, day: 30 },
    dueText: 'By 30 April each year.', legalBasis: 'Code des impôts directs et taxes assimilées', source: S(DZ_CAL),
  },
  {
    id: 'dz-ibs-acomptes', jurisdiction: 'DZ', name: 'IBS instalments', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['company'], due: { kind: 'fixed-dates', dates: [{ month: 3, day: 20 }, { month: 6, day: 20 }, { month: 11, day: 20 }] },
    dueText: 'By 20 March, 20 June and 20 November; sources differ on when the balance falls due.', legalBasis: 'Code des impôts directs et taxes assimilées', source: S(DZ_CAL),
  },
  {
    id: 'dz-cnas', jurisdiction: 'DZ', name: 'CNAS social security contributions', authority: 'Caisse Nationale des Assurances Sociales (CNAS)',
    appliesTo: ['employer'], due: { kind: 'event', text: 'within 30 days after each month' },
    dueText: 'Within 30 days after the month the salaries relate to.', legalBasis: 'Social security legislation', source: S(DZ_CAL),
  },
  // ---- Tunisia ----
  {
    id: 'tn-monthly', jurisdiction: 'TN', name: 'Monthly declaration (VAT, withholding tax, TFP, TCL)', authority: 'Direction Générale des Impôts (DGI), via TEJ',
    appliesTo: ['company', 'employer', 'vat-registered', 'ngo'], due: { kind: 'monthly', day: 28 },
    dueText: 'Legal persons by the 28th of the following month (individuals by the 15th).', legalBasis: 'Code de la TVA; Code de l\'IRPP et de l\'IS', source: O('https://www.finances.gov.tn/fr/apercu-general-sur-la-fiscalite'),
  },
  {
    id: 'tn-acomptes', jurisdiction: 'TN', name: 'Provisional corporate tax instalments', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['company'], due: { kind: 'fixed-dates', dates: [{ month: 6, day: 28 }, { month: 9, day: 28 }, { month: 12, day: 28 }] },
    dueText: 'Three instalments of 30% of the previous year\'s tax, in the 6th, 9th and 12th months (by the 28th for legal persons).',
    legalBasis: 'Code de l\'IRPP et de l\'IS', source: S('https://www.bfc.com.tn/blog/acomptes-provisionnels-tunisie-calcul-echeances'),
  },
  {
    id: 'tn-employer', jurisdiction: 'TN', name: 'Annual employer declaration', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['employer'], due: { kind: 'annual-fixed', month: 2, day: 28 },
    dueText: 'By 28 February for the previous year.', legalBasis: 'Code de l\'IRPP et de l\'IS', source: S(TN_CAL),
  },
  // ---- Libya ----
  {
    id: 'ly-cit', jurisdiction: 'LY', name: 'Corporate income tax return', authority: 'Libyan Tax Authority',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 4 },
    dueText: 'Within one month after the accounts are approved and no later than four months after the year end. Libya has no VAT.',
    legalBasis: 'Income Tax Law No. 7 of 2010', source: S('https://taxsummaries.pwc.com/libya/corporate/tax-administration'),
  },
  {
    id: 'ly-inas', jurisdiction: 'LY', name: 'Social security contributions (INAS)', authority: 'Social Security Fund (INAS)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 10 },
    dueText: 'Withheld and paid monthly, within ten days after the month end.', legalBasis: 'Social security legislation', source: S('https://taxsummaries.pwc.com/libya/corporate/tax-administration'),
  },
  // ---- Mauritania ----
  {
    id: 'mr-cit', jurisdiction: 'MR', name: 'Annual tax return and financial statements', authority: 'Direction Générale des Impôts',
    appliesTo: ['company'], due: { kind: 'annual-fixed', month: 3, day: 31 },
    dueText: 'Before 31 March of the following year.', legalBasis: 'Code Général des Impôts', source: S('https://taxsummaries.pwc.com/mauritania/corporate/tax-administration'),
  },
  {
    id: 'mr-vat', jurisdiction: 'MR', name: 'VAT return', authority: 'Direction Générale des Impôts',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 15 },
    dueText: 'Monthly, normally by the 15th.', legalBasis: 'Code Général des Impôts', notes: 'From an 18-month-old guide; confirm with the DGI.', source: S('https://www.kreston.com/vat-guide/mauritania/'),
  },
]
