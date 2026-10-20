// Guinea, Cameroon, Gabon, Republic of the Congo, DR Congo and Chad: recurring statutory filings, checked 19 October 2026.
import type { StatutoryFiling } from './index.ts'

const C = '2026-10-19'
const O = (url: string) => ({ url, kind: 'official' as const, checked: C })
const S = (url: string) => ({ url, kind: 'secondary' as const, checked: C })

export const CENTRAL_FILINGS: StatutoryFiling[] = [
  // ---- Guinea ----
  {
    id: 'gn-monthly', jurisdiction: 'GN', name: 'Monthly unified return (RTS on salaries) and CNSS', authority: 'Direction Nationale des Impôts; Caisse Nationale de Sécurité Sociale (CNSS)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 15 },
    dueText: 'Tax withheld on salaries (RTS) with the Déclaration Mensuelle Unique, and CNSS returns, by the 15th of the following month.',
    legalBasis: 'Code Général des Impôts; social security code', notes: 'Sources date from 2017 to 2026; confirm with the tax office and the CNSS.',
    source: S('https://africarrieres.com/guinea/en/guide/employeur-entreprise/employer-taxes'),
  },
  {
    id: 'gn-is', jurisdiction: 'GN', name: 'Corporate tax: instalments and balance', authority: 'Direction Nationale des Impôts',
    appliesTo: ['company'], due: { kind: 'fixed-dates', dates: [{ month: 4, day: 30 }, { month: 6, day: 15 }, { month: 9, day: 30 }] },
    dueText: 'Balance on the profit declaration by 30 April; instalments by 15 June and 30 September.', legalBasis: 'Code Général des Impôts',
    source: O('https://www.mbudget.gov.gn/wp-content/uploads/2017/08/SFG.pdf'),
  },
  // ---- Cameroon ----
  {
    id: 'cm-monthly', jurisdiction: 'CM', name: 'Monthly return (VAT, tax instalments, withholdings)', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['company', 'employer', 'vat-registered'], due: { kind: 'monthly', day: 15 },
    dueText: 'Filed and paid within the first 15 days of the following month.', legalBasis: 'Code Général des Impôts', source: O('https://www.impots.cm/fr/calendrier-fiscal'),
  },
  {
    id: 'cm-dsf', jurisdiction: 'CM', name: 'Annual statistical and tax return (DSF) and balance of tax', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['company'], due: { kind: 'annual-fixed', month: 3, day: 15 },
    dueText: 'By 15 March (the DGI sometimes extends this by communiqué).', legalBasis: 'Code Général des Impôts', source: O('https://www.impots.cm/fr/calendrier-fiscal'),
  },
  // ---- Gabon ----
  {
    id: 'ga-tva', jurisdiction: 'GA', name: 'VAT return', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 20 },
    dueText: 'Monthly, by the 20th of the following month (moving to the E-tax platform).', legalBasis: 'Code Général des Impôts', source: S('https://casskai.app/en/solutions/gabon'),
  },
  {
    id: 'ga-dsf', jurisdiction: 'GA', name: 'Annual statistical and tax return (DSF)', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['company'], due: { kind: 'annual-fixed', month: 4, day: 30 },
    dueText: 'By 30 April in most cases; quarterly advance payments apply.', legalBasis: 'Code Général des Impôts', source: S('https://casskai.app/en/solutions/gabon'),
  },
  // ---- Republic of the Congo ----
  {
    id: 'cg-monthly', jurisdiction: 'CG', name: 'Monthly VAT and payroll declarations', authority: 'Direction Générale des Impôts et des Domaines',
    appliesTo: ['vat-registered', 'employer'], due: { kind: 'monthly', day: 15 },
    dueText: 'By the 15th of the following month for companies under the real regime.', legalBasis: 'Code Général des Impôts',
    notes: 'An older notice gives a window from the 10th to the 20th; confirm with the tax office.', source: S('https://prisme242.com/categorie/fiscalite/calendrier-fiscal-2026-congo-echeances-entreprises'),
  },
  {
    id: 'cg-dsf', jurisdiction: 'CG', name: 'Annual statistical and tax return (DSF)', authority: 'Direction Générale des Impôts et des Domaines',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 6 },
    dueText: 'Within six months after the year end; corporate tax is paid in quarterly instalments.', legalBasis: 'Code Général des Impôts', source: S('https://almathe.net/ressources/fiscalite-entreprises-congo-2026.html'),
  },
  // ---- DR Congo ----
  {
    id: 'cd-monthly', jurisdiction: 'CD', name: 'Monthly VAT and IPR (tax on salaries) returns', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['vat-registered', 'employer'], due: { kind: 'monthly', day: 15 },
    dueText: 'By the 15th of the following month (the DGI has moved the date when the 15th falls on a weekend).', legalBasis: 'Code des impôts', source: O('https://dgi.services/'),
  },
  {
    id: 'cd-ibp', jurisdiction: 'CD', name: 'Profit tax return (IBP)', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['company'], due: { kind: 'annual-fixed', month: 3, day: 31 },
    dueText: 'By 31 March of the following year.', legalBasis: 'Code des impôts', notes: 'One guide gives 30 April; the DGI portal gives 31 March.', source: O('https://dgi.services/'),
  },
  {
    id: 'cd-ipr-annual', jurisdiction: 'CD', name: 'Annual IPR and IERE summary return', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['employer'], due: { kind: 'annual-fixed', month: 2, day: 15 },
    dueText: 'By 15 February for the previous year.', legalBasis: 'Code des impôts', source: S('https://www.congoquotidien.com/2025/02/14/actualite-rdc-dgi-ipr-iere/'),
  },
  // ---- Chad ----
  {
    id: 'td-tva', jurisdiction: 'TD', name: 'VAT return', authority: 'Direction Générale des Impôts',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 15 },
    dueText: 'Monthly, by the 15th of the following month.', legalBasis: 'Code Général des Impôts',
    notes: 'From a guide about three years old; confirm with the DGI.', source: S('https://centralafricataxguide.com/the-republic-of-chad/value-added-tax-vat/'),
  },
]
