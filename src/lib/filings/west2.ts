// Côte d'Ivoire, Benin, Togo, Burkina Faso, Mali, Sierra Leone, Liberia and The Gambia: recurring statutory filings,
// checked 19 October 2026. Only dates confirmed by a source are included; conflicts are stated in notes.
// Not yet included: Burkina Faso IUTS date (sources give the 15th or 20th) and instalments; Mali monthly VAT date and
// instalments; Côte d'Ivoire instalment dates (sources conflict); The Gambia corporate return date; NASSIT date.
import type { StatutoryFiling } from './index.ts'

const C = '2026-10-19'
const O = (url: string) => ({ url, kind: 'official' as const, checked: C })
const S = (url: string) => ({ url, kind: 'secondary' as const, checked: C })
const ohada30April = (j: string, authority: string, src: { url: string; kind: 'official' | 'secondary'; checked: string }): StatutoryFiling => ({
  id: `${j.toLowerCase()}-is-return`, jurisdiction: j, name: 'Corporate tax return and financial statements (SYSCOHADA)', authority,
  appliesTo: ['company'], due: { kind: 'annual-fixed', month: 4, day: 30 },
  dueText: 'Annual return, SYSCOHADA financial statements and balance of tax by 30 April of the following year.',
  legalBasis: 'Code Général des Impôts; OHADA Uniform Act on Accounting', source: src,
})

export const WEST2_FILINGS: StatutoryFiling[] = [
  // ---- Côte d'Ivoire ----
  {
    id: 'ci-tva', jurisdiction: 'CI', name: 'VAT return and payment', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 15 },
    dueText: 'Monthly, by the 15th of the following month.', legalBasis: 'Code Général des Impôts', source: O('https://www.dgi.gouv.ci/assets/documents/CALENDRIER.pdf'),
  },
  ohada30April('CI', 'Direction Générale des Impôts (DGI)', O('https://www.dgi.gouv.ci/assets/documents/CALENDRIER.pdf')),
  {
    id: 'ci-cnps', jurisdiction: 'CI', name: 'CNPS social security declaration (DISA)', authority: 'Caisse Nationale de Prévoyance Sociale (CNPS)',
    appliesTo: ['employer'], due: { kind: 'event', text: 'quarterly, around the 30th of the month after each quarter' },
    dueText: 'Quarterly declarations and payments, around the 30th of the month after each quarter (larger employers may pay monthly).',
    legalBasis: 'Code de prévoyance sociale', notes: 'Confirm your periodicity with the CNPS.', source: S('https://www.gedbered.com/blog/declaration-fiscale-dgi-2026.html'),
  },
  // ---- Benin ----
  {
    id: 'bj-monthly', jurisdiction: 'BJ', name: 'VAT and tax on salaries (ITS)', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['vat-registered', 'employer'], due: { kind: 'monthly', day: 10 },
    dueText: 'Declared and paid by the 10th of the following month.', legalBasis: 'Code Général des Impôts (article 125 for tax on salaries)',
    notes: 'From a 2024 chamber of commerce guide; confirm against the 2026 DGI calendar.', source: S('https://www.yoon.africa/guide-pratique/fiscalite-entreprises-benin'),
  },
  {
    id: 'bj-is-acomptes', jurisdiction: 'BJ', name: 'Corporate tax instalments', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['company'], due: { kind: 'fixed-dates', dates: [{ month: 3, day: 10 }, { month: 6, day: 10 }, { month: 9, day: 10 }, { month: 12, day: 10 }] },
    dueText: 'Four instalments by 10 March, 10 June, 10 September and 10 December; the balance before 1 May.', legalBasis: 'Code Général des Impôts',
    source: S('https://www.yoon.africa/guide-pratique/fiscalite-entreprises-benin'),
  },
  ohada30April('BJ', 'Direction Générale des Impôts (DGI)', S('https://www.yoon.africa/guide-pratique/fiscalite-entreprises-benin')),
  // ---- Togo ----
  {
    id: 'tg-monthly', jurisdiction: 'TG', name: 'Monthly VAT, salary tax (IRPP), withholdings and CNSS', authority: 'Office Togolais des Recettes (OTR); Caisse Nationale de Sécurité Sociale (CNSS)',
    appliesTo: ['vat-registered', 'employer', 'company', 'ngo'], due: { kind: 'monthly', day: 15 },
    dueText: 'By the 15th of the following month; late filing costs 10% in the first month, then 1% a month.', legalBasis: 'Code Général des Impôts; social security code',
    source: S('https://auditcomtogo.com/declarations-fiscales-au-togo-en-2026-calendrier-obligations-et-conseils-pratiques/'),
  },
  {
    id: 'tg-is-acomptes', jurisdiction: 'TG', name: 'Corporate tax instalments', authority: 'Office Togolais des Recettes (OTR)',
    appliesTo: ['company'], due: { kind: 'fixed-dates', dates: [{ month: 1, day: 31 }, { month: 5, day: 31 }, { month: 7, day: 31 }, { month: 10, day: 31 }] },
    dueText: 'Four instalments, each a quarter of the previous year\'s tax, by 31 January, 31 May, 31 July and 31 October.', legalBasis: 'Code Général des Impôts',
    source: S('https://auditcomtogo.com/declarations-fiscales-au-togo-en-2026-calendrier-obligations-et-conseils-pratiques/'),
  },
  ohada30April('TG', 'Office Togolais des Recettes (OTR)', S('https://auditcomtogo.com/declarations-fiscales-au-togo-en-2026-calendrier-obligations-et-conseils-pratiques/')),
  // ---- Burkina Faso ----
  ohada30April('BF', 'Direction Générale des Impôts (DGI)', O('https://dgi.bf/verification/CGI')),
  {
    id: 'bf-tva', jurisdiction: 'BF', name: 'VAT return', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 20 },
    dueText: 'Monthly, by the 20th of the following month (or quarterly).', legalBasis: 'Code Général des Impôts',
    notes: 'From a single secondary source; confirm with the DGI.', source: S('https://casskai.app/en/solutions/burkina-faso'),
  },
  {
    id: 'bf-cnss', jurisdiction: 'BF', name: 'CNSS contributions', authority: 'Caisse Nationale de Sécurité Sociale (CNSS)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 15 },
    dueText: 'Monthly declaration and payment before the 15th of the following month; annual salary declaration before 31 January.',
    legalBasis: 'Social security code', source: S('https://africarrieres.com/burkina-faso/en/guide/employeur-entreprise/employer-taxes'),
  },
  // ---- Mali ----
  ohada30April('ML', 'Direction Générale des Impôts (DGI)', O('https://www.dgi.gouv.ml/CGI/')),
  {
    id: 'ml-tva-retenue', jurisdiction: 'ML', name: 'VAT withheld at source', authority: 'Direction Générale des Impôts (DGI)',
    appliesTo: ['company', 'ngo'], due: { kind: 'monthly', day: 15 },
    dueText: 'VAT withheld is paid by the 15th of the following month.', legalBasis: 'Code Général des Impôts', source: O('https://www.dgi.gouv.ml/CGI/'),
  },
  // ---- Sierra Leone ----
  {
    id: 'sl-paye', jurisdiction: 'SL', name: 'PAYE return and payment', authority: 'National Revenue Authority (NRA)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 15 },
    dueText: 'By the 15th of the month after salaries are paid.', legalBasis: 'Income Tax Act 2000', source: O('https://www.sliepa.gov.sl/media/userfiles/subsite_198/files/2022%20NRA%20TAX%20GUIDE_0.pdf'),
  },
  {
    id: 'sl-gst', jurisdiction: 'SL', name: 'GST return and payment', authority: 'National Revenue Authority (NRA)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 21 },
    dueText: 'Within 21 days after the end of each tax period.', legalBasis: 'Goods and Services Tax Act, as amended by the Finance Act 2025', source: O('https://mof.gov.sl/wp-content/uploads/2025/01/The-Finance-Act-2025.pdf'),
  },
  {
    id: 'sl-cit', jurisdiction: 'SL', name: 'Company income tax return', authority: 'National Revenue Authority (NRA)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 4 },
    dueText: 'Not later than 120 days after the end of the accounting year.', legalBasis: 'Income Tax Act 2000', source: O('https://www.sliepa.gov.sl/media/userfiles/subsite_198/files/2022%20NRA%20TAX%20GUIDE_0.pdf'),
  },
  {
    id: 'sl-payroll-tax', jurisdiction: 'SL', name: 'Payroll tax for non-citizen employees', authority: 'National Revenue Authority (NRA)',
    appliesTo: ['employer'], due: { kind: 'annual-fixed', month: 1, day: 31 },
    dueText: 'Employers of non-citizens pay by 31 January each year.', legalBasis: 'Payroll tax legislation', source: O('https://www.sliepa.gov.sl/media/userfiles/subsite_198/files/2022%20NRA%20TAX%20GUIDE_0.pdf'),
  },
  // ---- Liberia ----
  {
    id: 'lr-paye', jurisdiction: 'LR', name: 'PAYE return and payment', authority: 'Liberia Revenue Authority (LRA)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 15 },
    dueText: 'By the 15th of the following month; annual PAYE reconciliation by 31 March.', legalBasis: 'Revenue Code of Liberia', source: S('https://paymasterliberia.com/blog/how-to-file-taxes-in-liberia-complete-guide'),
  },
  {
    id: 'lr-gst', jurisdiction: 'LR', name: 'GST return and payment', authority: 'Liberia Revenue Authority (LRA)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 21 },
    dueText: 'By the 21st of the following month.', legalBasis: 'Revenue Code of Liberia', source: S('https://paymasterliberia.com/blog/how-to-file-taxes-in-liberia-complete-guide'),
  },
  {
    id: 'lr-cit', jurisdiction: 'LR', name: 'Annual income tax return', authority: 'Liberia Revenue Authority (LRA)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 3 },
    dueText: 'Within three months after the end of the fiscal year.', legalBasis: 'Revenue Code of Liberia', source: S('https://paymasterliberia.com/blog/how-to-file-taxes-in-liberia-complete-guide'),
  },
  // ---- The Gambia ----
  {
    id: 'gm-monthly', jurisdiction: 'GM', name: 'PAYE and VAT returns', authority: 'Gambia Revenue Authority (GRA)',
    appliesTo: ['employer', 'vat-registered'], due: { kind: 'monthly', day: 15 },
    dueText: 'Monthly, by the 15th of the following month.', legalBasis: 'Income and Value Added Tax Act 2012, as amended', source: S('https://headoffice.app/gambia/blog/gambia-tax-forms'),
  },
]
