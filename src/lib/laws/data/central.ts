// Phase 2, Central Africa: BI, CM, CF, TD, CG, CD, GQ, GA, ST. Pending review.
// CEMAC members share OHADA company and accounting law, BEAC/COBAC banking rules, the CEMAC AML regulation and the COSUMAF market.
import type { LawEntry } from '../types.ts'
import { finalize, O, R, S, T } from './helpers.ts'

const ag = (c: string) => S(`https://www.addleshawgoddard.com/en/doing-business-in-africa/africa-countries-a-z-list/${c}/`)
const leap = (c: string) => S(`https://leap.unep.org/en/countries/${c}`)
const dla = (c: string) => S(`https://www.dlapiperdataprotection.com/index.html?t=law&c=${c}`)
const dpa = (c: string) => S(`https://dataprotection.africa/${c}/`)
const icnl = (c: string) => S(`https://www.icnl.org/resources/civic-freedom-monitor/${c}`)
const cemac = (j: string) => [R.ohadaCompany(j), R.syscohada(j), R.cemacBank(j), R.cemacAml(j), R.cemacCapital(j), R.cemacGov(j)]

export const CENTRAL_LAWS: LawEntry[] = finalize([
  // ---- Burundi (EAC; not OHADA) ----
  T.company('BI', { title: 'Code of private and public companies', citation: 'Law of 2011, as amended', regulator: 'Agence de Développement du Burundi (business registration)', source: ag('burundi') }),
  T.ngo('BI', { title: 'Law on non-profit organisations', citation: 'Law of 2017', regulator: 'Ministry of the Interior', source: icnl('burundi'), extra: 'Foreign NGOs follow a separate law with funding and staffing conditions.' }),
  T.noData('BI', { title: 'No comprehensive data protection law', citation: 'Confidentiality rules in the 2022 law on cybercrime', regulator: null, source: dla('BI') }),
  T.corruption('BI', { title: 'Law on anti-corruption measures', citation: 'Law of 2006, as amended', regulator: 'the anti-corruption brigade and special anti-corruption court', source: ag('burundi') }),
  T.aml('BI', { title: 'Law on combating money laundering and terrorist financing', citation: 'As amended', regulator: 'the financial intelligence unit', source: ag('burundi') }),
  T.procurement('BI', { title: 'Public Procurement Code', citation: 'Law of 2018', regulator: "the Autorité de Régulation des Marchés Publics (ARMP)", source: ag('burundi') }),
  T.govNone('BI', { title: 'No national corporate governance code', citation: 'Central bank governance rules for banks', regulator: 'Banque de la République du Burundi', source: O('https://www.brb.bi/') }),
  T.labour('BI', { title: 'Labour Code', citation: 'Law of 2020', regulator: 'Labour inspectorate', source: ag('burundi') }),
  T.eia('BI', { title: 'Environment Code (environmental assessment provisions)', citation: 'Law of 2021', regulator: "the Office Burundais pour la Protection de l'Environnement", source: leap('bi') }),
  T.sustain('BI', { title: 'Environment Code', citation: 'Law of 2021', regulator: 'Ministry of Environment', source: leap('bi') }),
  T.bank('BI', { title: 'Banking law', citation: 'Law of 2017', regulator: 'the Banque de la République du Burundi', source: O('https://www.brb.bi/') }),
  T.noMarket('BI', { title: 'No stock exchange or capital markets law in operation', citation: 'Company and banking law apply to any public offer', regulator: null, source: ag('burundi') }),

  // ---- Cameroon ----
  ...cemac('CM'),
  T.ngo('CM', { title: 'Laws on freedom of association and on NGOs', citation: 'Law No. 90/053 of 1990; Law No. 99/014 of 1999', regulator: 'Ministry of Territorial Administration', source: icnl('cameroon') }),
  T.data('CM', { title: 'Law on the protection of personal data', citation: 'Law of 2024', regulator: null, source: dla('CM'), extra: 'Recently adopted; confirm commencement and the regulator.' }),
  T.corruption('CM', { title: 'Penal Code corruption offences and the National Anti-Corruption Commission', citation: 'Decree of 2006 establishing CONAC', regulator: 'the National Anti-Corruption Commission (CONAC)', source: ag('cameroon') }),
  T.procurement('CM', { title: 'Public Procurement Code', citation: 'Decree of 2018', regulator: "the Agence de Régulation des Marchés Publics (ARMP)", source: ag('cameroon') }),
  T.labour('CM', { title: 'Labour Code', citation: 'Law No. 92/007 of 1992', regulator: 'Labour inspectorate', source: ag('cameroon') }),
  T.eia('CM', { title: 'Framework Law on environmental management and EIA decree', citation: 'Law No. 96/12 of 1996; EIA decree of 2013', regulator: 'the Ministry of Environment (MINEPDED)', source: leap('cm') }),
  T.sustain('CM', { title: 'Framework Law on environmental management', citation: 'Law No. 96/12 of 1996', regulator: 'Ministry of Environment', source: leap('cm') }),

  // ---- Central African Republic ----
  ...cemac('CF'),
  T.ngo('CF', { title: 'Law on associations', citation: 'As amended', regulator: 'Ministry of Territorial Administration', source: ag('central-african-republic') }),
  T.data('CF', { title: 'Law on the protection of personal data', citation: 'Law No. 24/001 of January 2024', regulator: null, source: dpa('central-african-republic'), extra: 'Confirm whether the data protection authority has been set up.' }),
  T.procurement('CF', { title: 'Public Procurement Code', citation: 'As amended', regulator: 'the public procurement regulatory authority', source: ag('central-african-republic') }),
  T.labour('CF', { title: 'Labour Code', citation: 'Law of 2009', regulator: 'Labour inspectorate', source: ag('central-african-republic') }),
  T.eia('CF', { title: 'Environment Code (environmental assessment provisions)', citation: 'Law of 2007', regulator: 'the Ministry of Environment', source: leap('cf') }),
  T.sustain('CF', { title: 'Environment Code', citation: 'Law of 2007', regulator: 'Ministry of Environment', source: leap('cf') }),

  // ---- Chad ----
  ...cemac('TD'),
  T.ngo('TD', { title: 'Law on associations', citation: 'As amended', regulator: 'Ministry of Territorial Administration', source: ag('chad') }),
  T.data('TD', { title: 'Law on the protection of personal data', citation: 'Law No. 007/PR/2015', regulator: null, source: dla('TD'), extra: 'Confirm which authority supervises the law in practice.' }),
  T.procurement('TD', { title: 'Public Procurement Code', citation: 'As amended', regulator: 'the public procurement regulatory authority', source: ag('chad') }),
  T.labour('TD', { title: 'Labour Code', citation: 'Law of 1996, as amended', regulator: 'Labour inspectorate', source: ag('chad') }),
  T.eia('TD', { title: 'Law on the general principles of environmental protection and EIA decree', citation: 'Law of 1998; EIA decree of 2010', regulator: 'the Ministry of Environment', source: leap('td') }),
  T.sustain('TD', { title: 'Law on the general principles of environmental protection', citation: 'Law of 1998', regulator: 'Ministry of Environment', source: leap('td') }),

  // ---- Republic of the Congo ----
  ...cemac('CG'),
  T.ngo('CG', { title: 'Law on associations (law of 1 July 1901, as applied)', citation: 'Law of 1901, with national implementing rules', regulator: 'Ministry of the Interior', source: icnl('republic-of-the-congo') }),
  T.data('CG', { title: 'Law on the protection of personal data', citation: 'Law No. 29-2019', regulator: null, source: dla('CG'), extra: 'Confirm whether the data protection authority is operating.' }),
  T.procurement('CG', { title: 'Public Procurement Code', citation: 'Decree of 2009, as amended', regulator: "the Autorité de Régulation des Marchés Publics (ARMP)", source: ag('republic-of-congo') }),
  T.labour('CG', { title: 'Labour Code', citation: 'Law No. 45-75 of 1975, as amended', regulator: 'Labour inspectorate', source: ag('republic-of-congo') }),
  T.eia('CG', { title: 'Law on environmental protection and EIA decree', citation: 'Law No. 003/91 of 1991; EIA decree of 2009', regulator: 'the Ministry of Environment', source: leap('cg') }),
  T.sustain('CG', { title: 'Law on environmental protection', citation: 'Law No. 003/91 of 1991', regulator: 'Ministry of Environment', source: leap('cg') }),

  // ---- Democratic Republic of the Congo (OHADA; not CEMAC) ----
  R.ohadaCompany('CD'),
  R.syscohada('CD'),
  T.ngo('CD', { title: 'Law on non-profit associations and public utility establishments', citation: 'Law No. 004/2001 of 2001', regulator: 'Ministry of Justice and line ministries', source: icnl('democratic-republic-of-the-congo') }),
  T.data('CD', { title: 'Digital Code (personal data protection provisions)', citation: 'Ordinance-Law No. 23/010 of 2023', regulator: null, source: dla('CD'), extra: 'Confirm the data protection authority created under the Digital Code.' }),
  T.corruption('CD', { title: 'Ordinance establishing the Agency for the Prevention and Fight against Corruption', citation: 'Ordinance of 2020', regulator: "the Agence de Prévention et de Lutte contre la Corruption (APLC)", source: ag('democratic-republic-of-congo') }),
  T.aml('CD', { title: 'Law on combating money laundering, terrorist financing and proliferation financing', citation: 'Law of 2022', regulator: 'the Cellule Nationale des Renseignements Financiers (CENAREF)', source: ag('democratic-republic-of-congo') }),
  T.procurement('CD', { title: 'Law on public procurement', citation: 'Law No. 10/010 of 2010', regulator: "the Autorité de Régulation des Marchés Publics (ARMP)", source: ag('democratic-republic-of-congo') }),
  T.govNone('CD', { title: 'No national corporate governance code', citation: 'OHADA company law; Central Bank governance rules for banks', regulator: 'Banque Centrale du Congo', source: O('https://www.bcc.cd/') }),
  T.labour('CD', { title: 'Labour Code', citation: 'Law No. 015/2002, as amended in 2016', regulator: 'Labour inspectorate', source: ag('democratic-republic-of-congo') }),
  T.eia('CD', { title: 'Law on the fundamental principles of environmental protection', citation: 'Law No. 11/009 of 2011', regulator: "the Agence Congolaise de l'Environnement", source: leap('cd') }),
  T.sustain('CD', { title: 'Law on the fundamental principles of environmental protection', citation: 'Law No. 11/009 of 2011', regulator: 'Ministry of Environment', source: leap('cd') }),
  T.bank('CD', { title: 'Banking law and Central Bank regulations', citation: 'As amended', regulator: 'the Banque Centrale du Congo', source: O('https://www.bcc.cd/') }),
  T.noMarket('CD', { title: 'No stock exchange in operation', citation: 'Company and banking law apply to any public offer', regulator: null, source: ag('democratic-republic-of-congo'), reformNote: 'A capital markets framework is being set up; check its status.' }),

  // ---- Equatorial Guinea ----
  ...cemac('GQ'),
  T.ngo('GQ', { title: 'Law on non-governmental organisations', citation: 'Law No. 1/1999', regulator: 'Ministry of the Interior', source: icnl('equatorial-guinea') }),
  T.data('GQ', { title: 'Law on the protection of personal data', citation: 'Law No. 1/2016', regulator: null, source: dla('GQ'), extra: 'Confirm whether a supervisory authority is operating.' }),
  T.procurement('GQ', { title: 'Public procurement law', citation: 'As amended', regulator: 'Ministry of Finance', source: ag('equatorial-guinea') }),
  T.labour('GQ', { title: 'Labour law', citation: 'Law of 1990, as amended', regulator: 'Ministry of Labour', source: ag('equatorial-guinea') }),
  T.eia('GQ', { title: 'Law on environmental regulation (EIA provisions)', citation: 'Law No. 7/2003', regulator: 'the Ministry of Environment', source: leap('gq') }),
  T.sustain('GQ', { title: 'Law on environmental regulation', citation: 'Law No. 7/2003', regulator: 'Ministry of Environment', source: leap('gq') }),

  // ---- Gabon ----
  ...cemac('GA'),
  T.ngo('GA', { title: 'Law on associations', citation: 'Law No. 35/62, as amended', regulator: 'Ministry of the Interior', source: icnl('gabon') }),
  T.data('GA', { title: 'Law on the protection of personal data', citation: 'Law No. 001/2011, as amended by Law No. 025/2023', regulator: "the Commission Nationale pour la Protection des Données à Caractère Personnel (CNPDCP)", source: dla('GA') }),
  T.corruption('GA', { title: 'Law on the prevention and repression of illicit enrichment', citation: 'As amended', regulator: "the national commission against illicit enrichment", source: ag('gabon') }),
  T.procurement('GA', { title: 'Public Procurement Code', citation: 'As amended', regulator: 'the public procurement regulatory authority', source: ag('gabon') }),
  T.labour('GA', { title: 'Labour Code', citation: 'Law of 2021', regulator: 'Labour inspectorate', source: ag('gabon') }),
  T.eia('GA', { title: 'Law on environmental protection and EIA decree', citation: 'Law No. 007/2014; EIA decree of 2005', regulator: 'the Ministry of Environment', source: leap('ga') }),
  T.sustain('GA', { title: 'Law on environmental protection and climate change legislation', citation: 'Law No. 007/2014; climate change ordinance of 2021', regulator: 'Ministry of Environment and Climate', source: leap('ga'), extra: 'Gabon also has a dedicated 2021 climate change instrument.' }),

  // ---- São Tomé and Príncipe (OHADA) ----
  R.ohadaCompany('ST'),
  R.syscohada('ST'),
  T.ngo('ST', { title: 'Law on associations', citation: 'As amended', regulator: 'Ministry of Justice', source: icnl('sao-tome-and-principe') }),
  T.data('ST', { title: 'Law on the protection of personal data (Lei de Proteção de Dados Pessoais)', citation: 'Law No. 03/2016', regulator: 'the Agência Nacional de Proteção de Dados Pessoais (ANPDP)', source: dpa('sao-tome-and-principe') }),
  T.aml('ST', { title: 'Law on combating money laundering and terrorist financing', citation: 'As amended', regulator: 'the financial intelligence unit', source: ag('sao-tome-and-principe') }),
  T.procurement('ST', { title: 'Public procurement law', citation: 'As amended', regulator: 'the public procurement authority', source: ag('sao-tome-and-principe') }),
  T.govNone('ST', { title: 'No national corporate governance code', citation: 'OHADA company law; Central Bank rules for banks', regulator: 'Banco Central de São Tomé e Príncipe', source: O('https://www.bcstp.st/') }),
  T.labour('ST', { title: 'Labour law', citation: 'As amended', regulator: 'Labour inspectorate', source: ag('sao-tome-and-principe') }),
  T.eia('ST', { title: 'Framework Law on the Environment and EIA decree', citation: 'Law No. 10/1999, with EIA decree', regulator: 'the Directorate-General for the Environment', source: leap('st') }),
  T.sustain('ST', { title: 'Framework Law on the Environment', citation: 'Law No. 10/1999', regulator: 'Directorate-General for the Environment', source: leap('st') }),
  T.bank('ST', { title: 'Financial institutions law', citation: 'As amended', regulator: 'the Banco Central de São Tomé e Príncipe', source: O('https://www.bcstp.st/') }),
  T.noMarket('ST', { title: 'No stock exchange or capital markets law', citation: 'Company and banking law apply to any public offer', regulator: null, source: ag('sao-tome-and-principe') }),
])
