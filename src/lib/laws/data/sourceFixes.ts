// Source links that could not be opened on 21 October 2026 (expired certificates, sites down, or deep links behind a
// bot check), replaced with a source that loads: the regulator or ministry where one was reachable, otherwise a
// recognised secondary guide (marked secondary). Applied after the phase 2 patches.
import type { Patch } from './phase2Tightened.ts'

export const SOURCE_FIXES_CHECKED = '2026-10-21'
const O = (url: string) => ({ source: { url, kind: 'official' as const } })
const S = (url: string) => ({ source: { url, kind: 'secondary' as const } })

export const SOURCE_FIXES: Record<string, Patch> = {
  // South Africa: the legal information institute's act pages sit behind a bot check
  'ZA-sustainability-1': O('https://www.dffe.gov.za/legislation/acts'),
  'ZA-sustainability-2': O('https://www.sars.gov.za/legal-counsel/primary-legislation/'),
  'ZA-consumer-1': O('https://www.thencc.org.za/'),
  'ZA-labour-5': O('https://www.labour.gov.za/'),
  'ZA-financial-2': O('https://www.fsca.co.za/'),
  'ZA-financial-4': O('https://www.fsca.co.za/'),
  'ZA-licensing-1': O('https://www.thedtic.gov.za/'),
  'ZA-data-3': O('https://www.justice.gov.za/legislation/acts/acts_full.html'),
  // Mauritius: the FSC site refuses automated and many browser requests
  'MU-data-1': O('https://dataprotection.govmu.org/'),
  'MU-integrity-1': O('https://www.fcc.mu/'),
  'MU-capital-1': O('https://attorneygeneral.govmu.org/'),
  'MU-financial-2': O('https://attorneygeneral.govmu.org/'),
  // Tunisia: the CTAF and Ministry of Finance sites did not respond; the CTAF sits within the central bank
  'TN-integrity-2': O('https://www.bct.gov.tn/'),
  'TN-sanctions-1': O('https://www.bct.gov.tn/'),
  'TN-tax-1': S('https://taxsummaries.pwc.com/tunisia'),
  // Others
  'MG-integrity-2': O('https://www.samifin.gov.mg/'),
  'ZM-data-1': O('https://www.parliament.gov.zm/node/8853'),
  'GH-labour-1': O('https://www.nlcghana.org/'),
  'BF-data-1': S('https://www.dlapiperdataprotection.com/?t=law&c=BF'),
  'EG-capital-1': O('https://www.fra.gov.eg/'),
}

// The seven jurisdictions held back on 21 October: links that still failed on 22 October (sites timing out, a
// government portal returning errors, UN databases behind a bot check). The official gazette, parliament, central
// bank or ministry where one loads; otherwise a recognised secondary database (marked secondary).
export const HELD_BACK_FIXES_CHECKED = '2026-10-22'
export const HELD_BACK_FIXES: Record<string, Patch> = {
  // Morocco: the CNDP and AMMC sites time out and ACAPS blocks requests; laws are published in the Bulletin officiel
  'MA-data-1': O('https://www.sgg.gov.ma/BulletinOfficiel.aspx'),
  'MA-capital-1': O('https://www.sgg.gov.ma/BulletinOfficiel.aspx'),
  'MA-financial-2': O('https://www.sgg.gov.ma/BulletinOfficiel.aspx'),
  // Botswana: the gov.bw portal returns errors
  'BW-integrity-1': O('https://www.parliament.gov.bw/'),
  // Malawi: MACRA answers without the www; the FIA site times out, and the central bank supervises AML compliance
  'MW-data-1': O('https://macra.mw/'),
  'MW-integrity-2': O('https://www.rbm.mw/'),
  'MW-sanctions-1': O('https://www.rbm.mw/'),
  // Egypt, Libya, Central African Republic: UN legal databases behind a bot check
  'EG-procurement-1': O('https://mof.gov.eg/en'),
  'LY-competition-1': S('https://lawsociety.ly/'),
  'LY-consumer-1': S('https://lawsociety.ly/'),
  'CF-licensing-1': O('https://www.gouv.cf/'),
}
