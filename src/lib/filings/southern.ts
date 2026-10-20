// Zambia, Zimbabwe, Malawi and Botswana: recurring statutory filings, checked 19 October 2026.
// Not yet included (sources conflict): Zimbabwe QPD dates (20 or 25 March, June, September; 15 or 20 December) and annual
// return date; Malawi VAT date and provisional tax; PACRA annual return date (Zambia).
import type { StatutoryFiling } from './index.ts'

const C = '2026-10-19'
const S = (url: string) => ({ url, kind: 'secondary' as const, checked: C })
const ZM_PWC = 'https://taxsummaries.pwc.com/zambia/corporate/tax-administration'
const ZM_CAL = 'https://mjconsultants.co.zm/tools/zambia-compliance-calendar/'
const ZW_CAL = 'https://mjconsultants.co.zw/tools/zimbabwe-compliance-calendar/'
const BW_PWC = 'https://taxsummaries.pwc.com/botswana/corporate/tax-administration'

export const SOUTHERN_FILINGS: StatutoryFiling[] = [
  // ---- Zambia ----
  {
    id: 'zm-cit', jurisdiction: 'ZM', name: 'Final income tax return and balance', authority: 'Zambia Revenue Authority (ZRA)',
    appliesTo: ['company'], due: { kind: 'annual-fixed', month: 6, day: 21 },
    dueText: 'E-filed by 21 June after the charge year (5 June if filed manually), with any unpaid balance.', legalBasis: 'Income Tax Act (Cap. 323)', source: S(ZM_PWC),
  },
  {
    id: 'zm-provisional', jurisdiction: 'ZM', name: 'Provisional tax returns', authority: 'Zambia Revenue Authority (ZRA)',
    appliesTo: ['company'], due: { kind: 'fixed-dates', dates: [{ month: 3, day: 31 }, { month: 6, day: 30 }, { month: 9, day: 30 }, { month: 12, day: 31 }] },
    dueText: 'Quarterly returns by 31 March, 30 June, 30 September and 31 December; payments by concession on the 10th of the month after each quarter.',
    legalBasis: 'Income Tax Act (Cap. 323)', source: S(ZM_PWC),
  },
  {
    id: 'zm-payroll', jurisdiction: 'ZM', name: 'PAYE, NAPSA, NHIMA and skills development levy', authority: 'Zambia Revenue Authority (ZRA); NAPSA; NHIMA',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 10 },
    dueText: 'Returns and payment by the 10th of the following month.', legalBasis: 'Income Tax Act; National Pension Scheme Act 1996; National Health Insurance Act 2018', source: S(ZM_CAL),
  },
  {
    id: 'zm-vat', jurisdiction: 'ZM', name: 'VAT return and payment', authority: 'Zambia Revenue Authority (ZRA)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 18 },
    dueText: 'By the 18th of the following month.', legalBasis: 'Value Added Tax Act', notes: 'One guide gives the 21st; most give the 18th.', source: S(ZM_CAL),
  },
  {
    id: 'zm-wht', jurisdiction: 'ZM', name: 'Withholding tax and turnover tax', authority: 'Zambia Revenue Authority (ZRA)',
    appliesTo: ['company', 'ngo'], due: { kind: 'monthly', day: 14 },
    dueText: 'By the 14th of the following month.', legalBasis: 'Income Tax Act (Cap. 323)', source: S(ZM_CAL),
  },
  // ---- Zimbabwe ----
  {
    id: 'zw-payroll', jurisdiction: 'ZW', name: 'PAYE, AIDS levy, NSSA, ZIMDEF and NEC', authority: 'Zimbabwe Revenue Authority (ZIMRA); National Social Security Authority (NSSA)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 10 },
    dueText: 'Paid by the 10th of the following month.', legalBasis: 'Income Tax Act (Chapter 23:06); NSSA Act (Chapter 17:04)',
    notes: 'One guide says the TaRMS PAYE return is filed by the 5th, with payment by the 10th.', source: S(ZW_CAL),
  },
  {
    id: 'zw-vat', jurisdiction: 'ZW', name: 'VAT return and payment', authority: 'Zimbabwe Revenue Authority (ZIMRA)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 25 },
    dueText: 'By the 25th of the month after each tax period (monthly or bi-monthly, by VAT category).', legalBasis: 'Value Added Tax Act (Chapter 23:12)',
    notes: 'One consultancy says TaRMS returns are due by the 10th and payment by the 15th; confirm with ZIMRA.', source: S(ZW_CAL),
  },
  // ---- Malawi ----
  {
    id: 'mw-paye', jurisdiction: 'MW', name: 'PAYE remittance', authority: 'Malawi Revenue Authority (MRA)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 14 },
    dueText: 'By the 14th of the following month.', legalBasis: 'Taxation Act (Cap. 41:01)', notes: 'Another calendar gives the 15th; the earlier date is shown.',
    source: S('https://www.africadocuments.com/deadlines/mw'),
  },
  // ---- Botswana ----
  {
    id: 'bw-cit', jurisdiction: 'BW', name: 'Company self-assessment tax return and balance', authority: 'Botswana Unified Revenue Service (BURS)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 4 },
    dueText: 'Within four months after the financial year end, with any balance of tax.', legalBasis: 'Income Tax Act (Cap. 52:01)', source: S(BW_PWC),
  },
  {
    id: 'bw-instalments', jurisdiction: 'BW', name: 'Quarterly tax instalments', authority: 'Botswana Unified Revenue Service (BURS)',
    appliesTo: ['company'], due: { kind: 'instalments', months: [3, 6, 9, 12], day: 31 },
    dueText: 'Where tax exceeds BWP 50,000: four equal instalments, the first within three months of the start of the year, then every three months.',
    legalBasis: 'Income Tax Act (Cap. 52:01)', source: S(BW_PWC),
  },
  {
    id: 'bw-paye', jurisdiction: 'BW', name: 'PAYE remittance', authority: 'Botswana Unified Revenue Service (BURS)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 15 },
    dueText: 'By the 15th of the following month; annual employer return after the 30 June tax year end.', legalBasis: 'Income Tax Act (Cap. 52:01)',
    source: S('https://www.countrytaxcalc.com/tax-guides/africa/botswana-paye-guide-2026/'),
  },
  {
    id: 'bw-vat', jurisdiction: 'BW', name: 'VAT return and payment', authority: 'Botswana Unified Revenue Service (BURS)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 25 },
    dueText: 'By the 25th of the month after each tax period (monthly or bi-monthly, by turnover).', legalBasis: 'Value Added Tax Act (Cap. 50:03)',
    source: S('https://taxdo.com/resources/countries/am/botswana'),
  },
  // ---- Angola ----
  {
    id: 'ao-ii', jurisdiction: 'AO', name: 'Industrial tax (corporate income tax) return', authority: 'Administração Geral Tributária (AGT)',
    appliesTo: ['company'], due: { kind: 'annual-fixed', month: 5, day: 31 },
    dueText: 'General regime: by the last business day of May (simplified regime: April); advance payment of 2% of sales excluded from withholding by the end of August.',
    legalBasis: 'Código do Imposto Industrial', notes: 'The AGT has extended this date when its portal failed.', source: S('https://taxsummaries.pwc.com/angola/corporate/tax-administration'),
  },
  // ---- Mozambique ----
  {
    id: 'mz-irpc', jurisdiction: 'MZ', name: 'Corporate income tax (IRPC) return', authority: 'Autoridade Tributária de Moçambique (AT)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 5 },
    dueText: 'By the last working day of May for calendar-year companies (otherwise the fifth month after the year end); three advance payments in May, July and September.',
    legalBasis: 'Código do IRPC', source: S('https://taxsummaries.pwc.com/mozambique/corporate/tax-administration'),
  },
  {
    id: 'mz-iva-inss', jurisdiction: 'MZ', name: 'Periodic VAT (IVA) return and INSS contributions', authority: 'Autoridade Tributária (AT); Instituto Nacional de Segurança Social (INSS)',
    appliesTo: ['vat-registered', 'employer'], due: { kind: 'monthly', day: 10 },
    dueText: 'VAT return (including nil and credit returns) and the INSS payroll sheet and contributions by the 10th of the following month.',
    legalBasis: 'Código do IVA; Lei da Protecção Social', notes: 'The 2026 tax reform changed VAT rules; confirm against the current AT calendar.',
    source: S('https://www.rsm.global/mozambique/sites/default/files/media/documents/Tax%20agenda%20February.pdf'),
  },
  {
    id: 'mz-irps', jurisdiction: 'MZ', name: 'Tax withheld on salaries (IRPS)', authority: 'Autoridade Tributária de Moçambique (AT)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 20 },
    dueText: 'Paid by the 20th of the following month.', legalBasis: 'Código do IRPS',
    source: S('https://www.rsm.global/mozambique/sites/default/files/media/documents/Tax%20agenda%20February.pdf'),
  },
  // ---- Namibia ----
  {
    id: 'na-cit', jurisdiction: 'NA', name: 'Company income tax return', authority: 'Namibia Revenue Agency (NamRA)',
    appliesTo: ['company'], due: { kind: 'annual-after-year-end', months: 7 },
    dueText: 'Within seven months after the year end (extendable by five months if no earlier returns are outstanding).',
    legalBasis: 'Income Tax Act 24 of 1981', source: S('https://taxsummaries.pwc.com/republic-of-namibia/corporate/tax-administration'),
  },
  {
    id: 'na-provisional', jurisdiction: 'NA', name: 'Provisional tax payments', authority: 'Namibia Revenue Agency (NamRA)',
    appliesTo: ['company'], due: { kind: 'instalments', months: [6, 12], day: 31 },
    dueText: 'First within six months of the start of the year, second by the last day of the year; a final top-up within seven months after the year end.',
    legalBasis: 'Income Tax Act 24 of 1981', source: S('https://taxsummaries.pwc.com/republic-of-namibia/corporate/tax-administration'),
  },
  {
    id: 'na-paye', jurisdiction: 'NA', name: 'PAYE remittance', authority: 'Namibia Revenue Agency (NamRA)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 20 },
    dueText: 'By the 20th of the month after the payroll deductions.', legalBasis: 'Income Tax Act 24 of 1981',
    source: S('https://taxsummaries.pwc.com/republic-of-namibia/individual/tax-administration'),
  },
  {
    id: 'na-vat', jurisdiction: 'NA', name: 'VAT return and payment', authority: 'Namibia Revenue Agency (NamRA)',
    appliesTo: ['vat-registered'], due: { kind: 'monthly', day: 25 },
    dueText: 'By the 25th of the month after each tax period (usually two months).', legalBasis: 'Value Added Tax Act 10 of 2000',
    source: S('https://www.cliffedekkerhofmeyr.com/guides/africa-corporate/namibia/compliance-requirements/are-there-any-annual-compliance-requirements-that-a-company-must-meet.html'),
  },
  // ---- Eswatini ----
  {
    id: 'sz-cit', jurisdiction: 'SZ', name: 'Income tax return', authority: 'Eswatini Revenue Service (ERS)',
    appliesTo: ['company'], due: { kind: 'annual-fixed', month: 10, day: 28 },
    dueText: 'Within 120 days of the 30 June year end; a 60-day extension is routinely given to compliant taxpayers.',
    legalBasis: 'Income Tax Order 1975', source: S('https://taxsummaries.pwc.com/eswatini/corporate/tax-administration'),
  },
  {
    id: 'sz-provisional', jurisdiction: 'SZ', name: 'Provisional tax payments', authority: 'Eswatini Revenue Service (ERS)',
    appliesTo: ['company'], due: { kind: 'instalments', months: [6, 12], day: 31 },
    dueText: 'Two instalments: six months into the financial year and by its last day.', legalBasis: 'Income Tax Order 1975',
    notes: 'PwC words the first date as "within six months of the financial year-end"; confirm with the ERS.', source: S('https://taxsummaries.pwc.com/eswatini/corporate/tax-administration'),
  },
  // ---- Lesotho ----
  {
    id: 'ls-paye', jurisdiction: 'LS', name: 'PAYE return and payment', authority: 'Revenue Services Lesotho (RSL)',
    appliesTo: ['employer'], due: { kind: 'monthly', day: 15 },
    dueText: 'By the 15th of the month after the tax was withheld.', legalBasis: 'Income Tax Act 1993', source: S('https://www.playroll.com/payroll/lesotho'),
  },
  // ---- Equatorial Guinea ----
  {
    id: 'gq-cit', jurisdiction: 'GQ', name: 'Corporate income tax return', authority: 'Ministerio de Hacienda, Economía y Planificación',
    appliesTo: ['company'], due: { kind: 'annual-fixed', month: 4, day: 30 },
    dueText: 'Within the first six months of the following year (30 April was set for recent years); tax paid within 15 days of filing. Minimum tax by 15 July and 15 January.',
    legalBasis: 'Tax law of Equatorial Guinea', source: S('https://taxsummaries.pwc.com/equatorial-guinea/corporate/tax-administration'),
  },
]
