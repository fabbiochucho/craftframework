// Nigeria: recurring statutory filings, checked 19 October 2026. The 2025 tax reform (Nigeria Tax Act 2025, Nigeria
// Tax Administration Act 2025, Nigeria Revenue Service Act 2025) took effect on 1 January 2026; FIRS became the
// Nigeria Revenue Service (NRS). PAYE is paid to the State Internal Revenue Service where employees live.
import type { StatutoryFiling } from './index.ts'

const C = '2026-10-19'
const O = (url: string) => ({ url, kind: 'official' as const, checked: C })
const S = (url: string) => ({ url, kind: 'secondary' as const, checked: C })
const TAX_CALENDAR = 'https://taxlytech.com/blog/tax-filing-deadlines-nigeria-2026.html'

export const NG_FILINGS: StatutoryFiling[] = [
  {
    id: 'ng-cac-annual-return', jurisdiction: 'NG', name: 'CAC annual return (companies)', authority: 'Corporate Affairs Commission (CAC)',
    appliesTo: ['company'], due: { kind: 'event', text: '42 days after the annual general meeting' },
    dueText: 'File within 42 days after each annual general meeting, every year after the year of incorporation.',
    legalBasis: 'Companies and Allied Matters Act 2020, section 421',
    notes: 'Late filing attracts penalties on the company and each director under the Companies Regulations 2021; long-running defaulters can be struck off.',
    source: O('https://www.cac.gov.ng/'),
  },
  {
    id: 'ng-cac-business-name', jurisdiction: 'NG', name: 'CAC annual return (business names)', authority: 'Corporate Affairs Commission (CAC)',
    appliesTo: ['business-name'], due: { kind: 'annual-fixed', month: 6, day: 30 },
    dueText: 'File by 30 June each year, except in the year of registration.',
    legalBasis: 'Companies and Allied Matters Act 2020, section 822', source: O('https://www.cac.gov.ng/'),
  },
  {
    id: 'ng-cac-trustees', jurisdiction: 'NG', name: 'CAC returns for incorporated trustees (NGOs)', authority: 'Corporate Affairs Commission (CAC)',
    appliesTo: ['ngo'], due: { kind: 'semi-annual-fixed', dates: [{ month: 1, day: 15 }, { month: 7, day: 15 }] },
    dueText: 'Statement of affairs made up to 30 June and 31 December, filed by 15 July and 15 January; the annual return comes with audited accounts.',
    legalBasis: 'Companies and Allied Matters Act 2020, Part F (section 848)',
    notes: 'A Senate bill to reduce this to once a year has been debated; check its status.',
    source: O('https://www.cac.gov.ng/'),
  },
  {
    id: 'ng-cit', jurisdiction: 'NG', name: 'Company income tax return', authority: 'Nigeria Revenue Service (NRS)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 6 },
    dueText: 'Within six months after the end of the accounting year; a new company files within 18 months of incorporation or six months after its first accounting period, whichever is earlier.',
    legalBasis: 'Nigeria Tax Administration Act 2025, section 11(5)',
    notes: 'Small companies under the Nigeria Tax Act 2025 thresholds are exempt from company income tax and the 4% development levy but still file.',
    source: S(TAX_CALENDAR),
  },
  {
    id: 'ng-vat', jurisdiction: 'NG', name: 'VAT return and remittance', authority: 'Nigeria Revenue Service (NRS)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 21 },
    dueText: 'Monthly, by the 21st day of the following month.',
    legalBasis: 'Nigeria Tax Administration Act 2025; Nigeria Tax Act 2025 (VAT at 7.5%)',
    notes: 'Small businesses under the turnover threshold in the Nigeria Tax Act 2025 need not charge VAT unless they opt in.',
    source: S(TAX_CALENDAR),
  },
  {
    id: 'ng-wht', jurisdiction: 'NG', name: 'Withholding tax remittance', authority: 'Nigeria Revenue Service (NRS), or the State IRS for individuals',
    appliesTo: ['company', 'ngo'], due: { kind: 'monthly', day: 21 },
    dueText: 'Tax withheld from payments to suppliers is remitted by the 21st day of the following month.',
    legalBasis: 'Nigeria Tax Administration Act 2025', source: S(TAX_CALENDAR),
  },
  {
    id: 'ng-paye', jurisdiction: 'NG', name: 'PAYE remittance', authority: 'State Internal Revenue Service (where employees live)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 10 },
    dueText: 'Monthly, by the 10th day of the following month.',
    legalBasis: 'Nigeria Tax Act 2025 and Nigeria Tax Administration Act 2025 (personal income tax); state revenue laws', source: S(TAX_CALENDAR),
  },
  {
    id: 'ng-paye-annual', jurisdiction: 'NG', name: 'Employer annual PAYE return', authority: 'State Internal Revenue Service',
    appliesTo: ['employer'], due: { kind: 'annual-fixed', month: 1, day: 31 },
    dueText: 'By 31 January, covering every employee\'s pay and tax for the previous year.',
    legalBasis: 'Nigeria Tax Administration Act 2025; state revenue laws', source: S(TAX_CALENDAR),
  },
  {
    id: 'ng-pension', jurisdiction: 'NG', name: 'Pension contributions remittance', authority: 'National Pension Commission (PenCom), to each employee\'s Pension Fund Administrator',
    appliesTo: ['employer'], due: { kind: 'event', text: 'within 7 working days after each payday' },
    dueText: 'Employer and employee contributions are remitted within 7 working days after salaries are paid.',
    legalBasis: 'Pension Reform Act 2014, section 11(3)',
    notes: 'Late remittance attracts a penalty set by PenCom (at least 2% of the amount a month).',
    source: O('https://www.pencom.gov.ng/'),
  },
  {
    id: 'ng-nsitf', jurisdiction: 'NG', name: 'Employees\' Compensation Scheme contribution (NSITF)', authority: 'Nigeria Social Insurance Trust Fund (NSITF)',
    appliesTo: ['employer'], due: { kind: 'event', text: 'monthly, on payroll' },
    dueText: 'Employer pays 1% of total monthly payroll; it is not deducted from staff pay.',
    legalBasis: 'Employees\' Compensation Act 2010',
    notes: 'The payroll base is disputed in practice (a 2016 NECA-NSITF agreement excludes some items); confirm the current basis with NSITF.',
    source: O('https://nsitf.gov.ng/about'),
  },
  {
    id: 'ng-nhf', jurisdiction: 'NG', name: 'National Housing Fund contributions', authority: 'Federal Mortgage Bank of Nigeria (FMBN)',
    appliesTo: ['employer'], due: { kind: 'event', text: 'within a month after each payday' },
    dueText: '2.5% of eligible employees\' monthly basic salary, deducted and remitted within a month.',
    legalBasis: 'National Housing Fund Act', source: O('https://www.fmbn.gov.ng/'),
  },
  {
    id: 'ng-itf', jurisdiction: 'NG', name: 'Industrial Training Fund contribution', authority: 'Industrial Training Fund (ITF)',
    appliesTo: ['employer'], due: { kind: 'annual-after-year-end', months: 3 },
    dueText: '1% of annual payroll, for employers with 5 or more staff or turnover of ₦50 million or more, with the return due within three months after the year end.',
    legalBasis: 'Industrial Training Fund Act (as amended)',
    notes: 'Sources differ on the filing date (some give 1 April); confirm with ITF.',
    source: O('https://itf.gov.ng/'),
  },
  {
    id: 'ng-scuml', jurisdiction: 'NG', name: 'SCUML registration and reporting (NGOs and designated businesses)', authority: 'Special Control Unit against Money Laundering (SCUML), EFCC',
    appliesTo: ['ngo'], due: { kind: 'one-off', text: 'register once; report through the SCUML portal as required' },
    dueText: 'Register once (free, online) and submit required reports through the SCUML portal; email reports are no longer accepted from 1 January 2026.',
    legalBasis: 'Money Laundering (Prevention and Prohibition) Act 2022; EFCC/SCUML Regulations 2022',
    source: O('https://scuml.efcc.gov.ng/'),
  },
]
