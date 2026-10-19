// Kenya: recurring statutory filings, checked 19 October 2026. Payroll items (PAYE, NSSF, SHIF, Housing Levy) are
// due around the 9th of the following month; VAT by the 20th; withholding tax within five working days of deduction.
import type { StatutoryFiling } from './index.ts'

const C = '2026-10-19'
const O = (url: string) => ({ url, kind: 'official' as const, checked: C })
const S = (url: string) => ({ url, kind: 'secondary' as const, checked: C })
const CAL = 'https://biasharaguide.co.ke/articles/tax-deadlines-calendar-kenya/'

export const KE_FILINGS: StatutoryFiling[] = [
  {
    id: 'ke-annual-return', jurisdiction: 'KE', name: 'Companies Registry annual return', authority: 'Business Registration Service (BRS), Registrar of Companies',
    appliesTo: ['company'], due: { kind: 'event', text: 'shortly after each anniversary of incorporation' },
    dueText: 'Filed on the eCitizen BRS portal after each anniversary of incorporation (the return date).',
    legalBasis: 'Companies Act 2015, section 705',
    notes: 'Sources give 28, 30 or 42 days after the anniversary; file within 28 days to be safe and confirm with BRS. Persistent non-filing can lead to strike-off.',
    source: O('https://brs.go.ke/'),
  },
  {
    id: 'ke-instalment', jurisdiction: 'KE', name: 'Instalment tax', authority: 'Kenya Revenue Authority (KRA)',
    appliesTo: ['company'], due: { kind: 'instalments', months: [4, 6, 9, 12], day: 20 },
    dueText: 'Four instalments of 25% (of the lower of 110% of the previous year\'s tax or the current year\'s estimate), by the 20th day of the 4th, 6th, 9th and 12th months of the accounting year.',
    legalBasis: 'Income Tax Act (Cap. 470)', notes: 'Not payable by persons on Turnover Tax.',
    source: O('https://www.kra.go.ke/individual/filing-paying/types-of-taxes/installment-tax'),
  },
  {
    id: 'ke-cit', jurisdiction: 'KE', name: 'Corporate income tax return', authority: 'Kenya Revenue Authority (KRA)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 6 },
    dueText: 'Self-assessment return and balance of tax within six months after the year end (30 June for a December year end).',
    legalBasis: 'Income Tax Act (Cap. 470); Tax Procedures Act 2015', source: S(CAL),
  },
  {
    id: 'ke-vat', jurisdiction: 'KE', name: 'VAT return and payment', authority: 'Kenya Revenue Authority (KRA)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 20 },
    dueText: 'Monthly, by the 20th day of the following month (invoices through eTIMS).',
    legalBasis: 'Value Added Tax Act 2013; Tax Procedures Act 2015', source: S(CAL),
  },
  {
    id: 'ke-wht', jurisdiction: 'KE', name: 'Withholding tax remittance', authority: 'Kenya Revenue Authority (KRA)',
    appliesTo: ['company', 'ngo'], due: { kind: 'event', text: 'within 5 working days after each deduction' },
    dueText: 'Tax withheld from qualifying payments is remitted within five working days after the deduction.',
    legalBasis: 'Income Tax Act (Cap. 470), section 35, as amended by the Finance Act 2023',
    notes: 'Late payment attracts a 5% penalty.', source: O('https://www.kra.go.ke/individual/filing-paying/types-of-taxes/individual-withholding-tax'),
  },
  {
    id: 'ke-paye', jurisdiction: 'KE', name: 'PAYE return and remittance', authority: 'Kenya Revenue Authority (KRA)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 9 },
    dueText: 'Monthly, by the 9th day of the following month (P10 return on iTax).',
    legalBasis: 'Income Tax Act (Cap. 470); Tax Procedures Act 2015', source: O('https://www.kra.go.ke/'),
  },
  {
    id: 'ke-housing-levy', jurisdiction: 'KE', name: 'Affordable Housing Levy', authority: 'Kenya Revenue Authority (KRA), for the Affordable Housing Fund',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 9 },
    dueText: '1.5% of gross pay from the employee plus 1.5% from the employer, remitted with PAYE (statutory deadline: the 9th working day after the month).',
    legalBasis: 'Affordable Housing Act 2024', source: O('https://bomayangu.go.ke/'),
  },
  {
    id: 'ke-shif', jurisdiction: 'KE', name: 'Social Health Insurance Fund (SHIF) contributions', authority: 'Social Health Authority (SHA)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 9 },
    dueText: '2.75% of each employee\'s gross salary (minimum KES 300), remitted by the 9th of the following month.',
    legalBasis: 'Social Health Insurance Act 2023 (replaced NHIF in October 2024)', source: O('https://sha.go.ke/'),
  },
  {
    id: 'ke-nssf', jurisdiction: 'KE', name: 'NSSF contributions', authority: 'National Social Security Fund (NSSF)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 9 },
    dueText: 'Employer and employee Tier I and Tier II contributions remitted by the 9th of the following month.',
    legalBasis: 'National Social Security Fund Act 2013',
    notes: 'The pensionable earnings limits rise in phases; check the current NSSF rates.', source: O('https://www.nssf.or.ke/'),
  },
]
