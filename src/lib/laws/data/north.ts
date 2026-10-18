// Phase 2, North Africa: DZ, LY, MR, TN. Pending review. Act numbers left out where they could not be confirmed.
import type { LawEntry } from '../types.ts'
import { finalize, O, S, T } from './helpers.ts'

const ag = (c: string) => S(`https://www.addleshawgoddard.com/en/doing-business-in-africa/africa-countries-a-z-list/${c}/`)
const leap = (c: string) => S(`https://leap.unep.org/en/countries/${c}`)
const dla = (c: string) => S(`https://www.dlapiperdataprotection.com/index.html?t=law&c=${c}`)
const icnl = (c: string) => S(`https://www.icnl.org/resources/civic-freedom-monitor/${c}`)

export const NORTH_LAWS: LawEntry[] = finalize([
  // ---- Algeria ----
  T.company('DZ', { title: 'Commercial Code (Code de commerce)', citation: 'Ordinance No. 75-59 of 1975, as amended', regulator: 'Centre National du Registre du Commerce', source: ag('algeria') }),
  T.ngo('DZ', { title: 'Law No. 12-06 on associations', citation: 'Law No. 12-06 of 12 January 2012', regulator: 'Ministry of the Interior', source: icnl('algeria'), extra: 'Prior registration with the authorities and approval rules for foreign funding apply.', reformNote: 'A replacement associations bill was under discussion in 2025.' }),
  T.data('DZ', { title: 'Law No. 18-07 on the protection of natural persons in the processing of personal data', citation: 'Law No. 18-07 of 10 June 2018', regulator: 'the Autorité Nationale de Protection des Données à caractère Personnel (ANPDP)', source: dla('DZ') }),
  T.corruption('DZ', { title: 'Law No. 06-01 on the prevention of and fight against corruption', citation: 'Law No. 06-01 of 2006, as amended', regulator: 'the High Authority for Transparency, Prevention and Fight against Corruption', source: ag('algeria') }),
  T.aml('DZ', { title: 'Law No. 05-01 on the prevention of and fight against money laundering and terrorist financing', citation: 'Law No. 05-01 of 2005, as amended (2023)', regulator: 'the Cellule de Traitement du Renseignement Financier (CTRF)', source: ag('algeria') }),
  T.procurement('DZ', { title: 'Law on the general rules of public procurement', citation: 'Law No. 23-12 of 2023', regulator: 'the public procurement regulation authority', source: ag('algeria') }),
  T.govNone('DZ', { title: 'No binding national corporate governance code', citation: 'Voluntary Algerian corporate governance code (2009); Bank of Algeria rules for banks; COSOB rules for listed companies', regulator: 'Bank of Algeria; COSOB', source: O('https://www.bank-of-algeria.dz/') }),
  T.labour('DZ', { title: 'Law No. 90-11 on employment relations', citation: 'Law No. 90-11 of 21 April 1990, as amended', regulator: 'Labour inspectorate', source: ag('algeria') }),
  T.eia('DZ', { title: 'Executive decree on environmental impact studies and notices', citation: 'Executive Decree No. 07-145 of 2007', regulator: 'the Ministry of Environment', source: leap('dz') }),
  T.sustain('DZ', { title: 'Law No. 03-10 on environmental protection in the framework of sustainable development', citation: 'Law No. 03-10 of 2003', regulator: 'Ministry of Environment', source: leap('dz') }),
  T.bank('DZ', { title: 'Law on Money and Credit', citation: 'Law No. 23-09 of 2023', regulator: 'the Bank of Algeria', source: O('https://www.bank-of-algeria.dz/'), extra: 'Companies keep accounts under the financial accounting system (SCF) of 2007.' }),
  T.securities('DZ', { title: 'Legislative decree on the securities exchange', citation: 'Legislative Decree No. 93-10 of 1993, as amended', regulator: 'COSOB, with listing on the Algiers Stock Exchange', source: O('https://www.cosob.org/') }),

  // ---- Libya ----
  T.company('LY', { title: 'Law on Commercial Activity', citation: 'Law No. 23 of 2010', regulator: 'Ministry of Economy (commercial register)', source: ag('libya') }),
  T.ngo('LY', { title: 'Associations law and Civil Society Commission rules', citation: 'Associations legislation, as applied by the Civil Society Commission', regulator: 'Civil Society Commission', source: ag('libya'), extra: 'Registration requirements have changed several times since 2011; confirm the current rules.' }),
  T.noData('LY', { title: 'No comprehensive data protection law', citation: 'Limited data provisions in the Electronic Transactions Law No. 6 of 2022', regulator: null, source: dla('LY') }),
  T.corruption('LY', { title: 'Law establishing the National Anti-Corruption Commission', citation: 'Law No. 11 of 2014', regulator: 'the National Anti-Corruption Commission', source: ag('libya') }),
  T.aml('LY', { title: 'Law on combating money laundering', citation: 'Law No. 2 of 2005, as amended', regulator: 'the Financial Information Unit at the Central Bank of Libya', source: ag('libya') }),
  T.procurement('LY', { title: 'Administrative Contracts Regulation', citation: 'Regulation of 2007', regulator: 'the Ministry of Finance and contracting authorities', source: ag('libya') }),
  T.govNone('LY', { title: 'No national corporate governance code', citation: 'Central Bank of Libya governance guidance for banks', regulator: 'Central Bank of Libya', source: O('https://cbl.gov.ly/') }),
  T.labour('LY', { title: 'Law on Labour Relations', citation: 'Law No. 12 of 2010', regulator: 'Ministry of Labour', source: ag('libya') }),
  T.eia('LY', { title: 'Law on the protection and improvement of the environment (EIA provisions)', citation: 'Law No. 15 of 2003', regulator: 'the Environment General Authority', source: leap('ly') }),
  T.sustain('LY', { title: 'Law on the protection and improvement of the environment', citation: 'Law No. 15 of 2003', regulator: 'Environment General Authority', source: leap('ly') }),
  T.bank('LY', { title: 'Banking Law', citation: 'Law No. 1 of 2005, as amended', regulator: 'the Central Bank of Libya', source: O('https://cbl.gov.ly/') }),
  T.securities('LY', { title: 'Capital Market Law', citation: 'Law No. 11 of 2010', regulator: 'the Libyan Stock Market and capital market regulator', source: ag('libya') }),

  // ---- Mauritania ----
  T.company('MR', { title: 'Commercial Code', citation: 'Law No. 2000-05, as amended', regulator: 'Registre du commerce', source: ag('mauritania') }),
  T.ngo('MR', { title: 'Law on associations, foundations and networks', citation: 'Law of 2021', regulator: 'Ministry of the Interior', source: ag('mauritania'), extra: 'Associations are created by declaration rather than prior authorisation.' }),
  T.noData('MR', { title: 'Law No. 2017-020 on personal data protection (not yet in effect)', citation: 'Law No. 2017-020', regulator: null, source: S('https://dataprotection.africa/mauritania/'), extra: 'The law is enacted but not yet applied.' }),
  T.corruption('MR', { title: 'Anti-corruption law', citation: 'Law No. 2016-014', regulator: null, source: ag('mauritania') }),
  T.aml('MR', { title: 'Law on combating money laundering and terrorist financing', citation: 'Law of 2019', regulator: 'the financial intelligence unit (CANIF)', source: ag('mauritania') }),
  T.procurement('MR', { title: 'Public Procurement Code', citation: 'Law of 2021', regulator: 'the public procurement regulatory authority (ARMP)', source: ag('mauritania') }),
  T.govNone('MR', { title: 'No national corporate governance code', citation: 'Central Bank of Mauritania rules for banks', regulator: 'Central Bank of Mauritania', source: O('https://www.bcm.mr/') }),
  T.labour('MR', { title: 'Labour Code', citation: 'Law No. 2004-017, as amended', regulator: 'Labour inspectorate', source: ag('mauritania') }),
  T.eia('MR', { title: 'Decree on environmental impact assessment', citation: 'Decree of 2004, as amended in 2007', regulator: 'the Ministry of Environment', source: leap('mr') }),
  T.sustain('MR', { title: 'Framework Law on the Environment', citation: 'Law No. 2000-045', regulator: 'Ministry of Environment', source: leap('mr') }),
  T.bank('MR', { title: 'Banking law and Central Bank of Mauritania regulations', citation: 'Banking law, as amended', regulator: 'the Central Bank of Mauritania', source: O('https://www.bcm.mr/') }),
  T.noMarket('MR', { title: 'No stock exchange or capital markets law', citation: 'Company and banking law apply to any public offer', regulator: null, source: ag('mauritania') }),

  // ---- Tunisia ----
  T.company('TN', { title: 'Commercial Companies Code (Code des sociétés commerciales)', citation: 'Law No. 2000-93 of 3 November 2000, as amended', regulator: 'Registre national des entreprises', source: ag('tunisia') }),
  T.ngo('TN', { title: 'Decree-Law on the organisation of associations', citation: 'Decree-Law No. 2011-88 of 24 September 2011', regulator: 'Presidency of the Government (associations department)', source: icnl('tunisia'), reformNote: 'Amendments to the associations framework have been proposed; check their status.' }),
  T.data('TN', { title: 'Organic Law on the protection of personal data', citation: 'Organic Law No. 2004-63 of 27 July 2004', regulator: "the Instance Nationale de Protection des Données Personnelles (INPDP)", source: dla('TN'), reformNote: 'A replacement data protection law has been proposed; check whether it has been adopted.' }),
  T.corruption('TN', { title: 'Organic Law on reporting corruption and protecting whistleblowers', citation: 'Organic Law No. 2017-10', regulator: null, source: ag('tunisia'), extra: 'Corruption offences are in the Penal Code.' }),
  T.aml('TN', { title: 'Organic Law on combating terrorism and money laundering', citation: 'Organic Law No. 2015-26, as amended by Organic Law No. 2019-9', regulator: 'the Commission Tunisienne des Analyses Financières (CTAF)', source: ag('tunisia') }),
  T.procurement('TN', { title: 'Decree on public procurement', citation: 'Decree No. 2014-1039', regulator: 'the High Authority for Public Procurement (HAICOP), through the TUNEPS e-procurement system', source: O('https://www.tuneps.tn/') }),
  T.govNone('TN', { title: 'No binding national corporate governance code', citation: 'Central Bank of Tunisia governance rules for banks; CMF rules for listed companies', regulator: 'Central Bank of Tunisia; CMF', source: O('https://www.bct.gov.tn/') }),
  T.labour('TN', { title: 'Labour Code', citation: 'Law No. 66-27 of 1966, as amended', regulator: 'Labour inspectorate', source: ag('tunisia') }),
  T.eia('TN', { title: 'Decree on environmental impact studies', citation: 'Decree No. 2005-1991', regulator: "the Agence Nationale de Protection de l'Environnement (ANPE)", source: leap('tn') }),
  T.sustain('TN', { title: 'Law establishing the National Environmental Protection Agency', citation: 'Law No. 88-91 of 1988, as amended', regulator: 'ANPE', source: leap('tn') }),
  T.bank('TN', { title: 'Law on banks and financial institutions', citation: 'Law No. 2016-48', regulator: 'the Central Bank of Tunisia', source: O('https://www.bct.gov.tn/'), extra: 'Company accounts follow the national accounting system law of 1996; listed groups also use IFRS.' }),
  T.securities('TN', { title: 'Law on the reorganisation of the financial market', citation: 'Law No. 94-117 of 1994, as amended', regulator: 'the Conseil du Marché Financier (CMF), with listing on the Bourse de Tunis', source: O('https://www.cmf.tn/') }),
])
