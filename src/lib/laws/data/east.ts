// Phase 2, East Africa: KM, DJ, ER, ET, MG, RW, SC, SO, SS, SD, TZ, UG. Pending review.
import type { LawEntry } from '../types.ts'
import { finalize, O, R, S, T } from './helpers.ts'

const ag = (c: string) => S(`https://www.addleshawgoddard.com/en/doing-business-in-africa/africa-countries-a-z-list/${c}/`)
const leap = (c: string) => S(`https://leap.unep.org/en/countries/${c}`)
const dla = (c: string) => S(`https://www.dlapiperdataprotection.com/index.html?t=law&c=${c}`)
const dpa = (c: string) => S(`https://dataprotection.africa/${c}/`)
const icnl = (c: string) => S(`https://www.icnl.org/resources/civic-freedom-monitor/${c}`)

export const EAST_LAWS: LawEntry[] = finalize([
  // ---- Rwanda ----
  T.company('RW', { title: 'Law governing companies', citation: 'Law No. 007/2021', regulator: 'the Rwanda Development Board (Office of the Registrar General)', source: O('https://rdb.rw/') }),
  T.ngo('RW', { title: 'Law governing national non-governmental organisations', citation: 'Law No. 04/2012, as amended', regulator: 'Rwanda Governance Board', source: O('https://www.rgb.rw/'), extra: 'International NGOs register with the Directorate General of Immigration and Emigration.' }),
  T.data('RW', { title: 'Law relating to the protection of personal data and privacy', citation: 'Law No. 058/2021', regulator: 'the National Cyber Security Authority', source: dla('RW'), extra: 'Controllers and processors must register; storing data outside Rwanda needs authorisation unless exempt.' }),
  T.corruption('RW', { title: 'Law on fighting against corruption', citation: 'Law No. 54/2018', regulator: 'the Office of the Ombudsman', source: ag('rwanda') }),
  T.aml('RW', { title: 'Law on the prevention and punishment of money laundering, terrorist financing and proliferation financing', citation: 'As amended', regulator: 'the Financial Intelligence Centre', source: O('https://fic.gov.rw/') }),
  T.procurement('RW', { title: 'Law governing public procurement', citation: 'Law No. 62/2018', regulator: 'the Rwanda Public Procurement Authority', source: O('https://www.rppa.gov.rw/') }),
  T.govCode('RW', { title: 'Corporate governance rules for listed companies and banks', citation: 'Capital Market Authority regulations; National Bank of Rwanda governance regulation', regulator: 'Capital Market Authority; National Bank of Rwanda', source: O('https://cma.rw/') }),
  T.labour('RW', { title: 'Law regulating labour in Rwanda', citation: 'Law No. 66/2018', regulator: 'Ministry of Public Service and Labour', source: ag('rwanda') }),
  T.eia('RW', { title: 'Law on environment (EIA provisions) and EIA ministerial order', citation: 'Law No. 48/2018, with implementing orders', regulator: 'the Rwanda Development Board and the Rwanda Environment Management Authority', source: O('https://www.rema.gov.rw/') }),
  T.sustain('RW', { title: 'Law on environment', citation: 'Law No. 48/2018', regulator: 'Rwanda Environment Management Authority', source: O('https://www.rema.gov.rw/') }),
  T.bank('RW', { title: 'Law governing banks', citation: 'Law No. 47/2017', regulator: 'the National Bank of Rwanda', source: O('https://www.bnr.rw/'), extra: 'Public interest entities report under IFRS; accountants are regulated by ICPAR.' }),
  T.securities('RW', { title: 'Capital market law and regulations', citation: 'As amended', regulator: 'the Capital Market Authority, with listing on the Rwanda Stock Exchange', source: O('https://cma.rw/') }),

  // ---- Tanzania ----
  T.company('TZ', { title: 'Companies Act', citation: 'Cap. 212', regulator: 'the Business Registrations and Licensing Agency (BRELA)', source: O('https://www.brela.go.tz/') }),
  T.ngo('TZ', { title: 'Non-Governmental Organisations Act', citation: 'Cap. 56 (2002), as amended in 2019', regulator: 'Registrar of NGOs', source: icnl('tanzania'), extra: 'NGOs must publish annual audited accounts and funding sources.' }),
  T.data('TZ', { title: 'Personal Data Protection Act, 2022', citation: 'Act No. 11 of 2022', regulator: 'the Personal Data Protection Commission', source: dla('TZ'), extra: 'Controllers and processors must register with the Commission.' }),
  T.corruption('TZ', { title: 'Prevention and Combating of Corruption Act', citation: 'Cap. 329 (2007)', regulator: 'the Prevention and Combating of Corruption Bureau', source: ag('tanzania') }),
  T.aml('TZ', { title: 'Anti-Money Laundering Act', citation: 'Cap. 423', regulator: 'the Financial Intelligence Unit', source: O('https://www.fiu.go.tz/') }),
  T.procurement('TZ', { title: 'Public Procurement Act, 2023', citation: 'Act of 2023', regulator: 'the Public Procurement Regulatory Authority', source: O('https://www.ppra.go.tz/') }),
  T.govCode('TZ', { title: 'Guidelines on corporate governance practices by public listed companies', citation: 'Capital Markets and Securities Authority guidelines', regulator: 'Capital Markets and Securities Authority', source: O('https://www.cmsa.go.tz/'), extra: 'Banks also follow Bank of Tanzania governance regulations.' }),
  T.labour('TZ', { title: 'Employment and Labour Relations Act', citation: 'Cap. 366 (2004)', regulator: 'Labour Commissioner', source: ag('tanzania') }),
  T.eia('TZ', { title: 'Environmental Management Act and EIA and Audit Regulations', citation: 'Cap. 191 (2004); EIA and Audit Regulations, as amended', regulator: 'the National Environment Management Council', source: O('https://www.nemc.or.tz/') }),
  T.sustain('TZ', { title: 'Environmental Management Act', citation: 'Cap. 191 (2004)', regulator: 'National Environment Management Council', source: O('https://www.nemc.or.tz/') }),
  T.bank('TZ', { title: 'Banking and Financial Institutions Act', citation: 'Cap. 342 (2006)', regulator: 'the Bank of Tanzania', source: O('https://www.bot.go.tz/') }),
  T.accounting('TZ', { title: 'Auditors and Accountants (Registration) Act and IFRS adoption', citation: 'Cap. 286', regulator: 'National Board of Accountants and Auditors', source: O('https://www.nbaa.go.tz/') }),
  T.securities('TZ', { title: 'Capital Markets and Securities Act', citation: 'Cap. 79', regulator: 'the Capital Markets and Securities Authority, with listing on the Dar es Salaam Stock Exchange', source: O('https://www.cmsa.go.tz/') }),

  // ---- Uganda ----
  T.company('UG', { title: 'Companies Act, 2012', citation: 'Act of 2012', regulator: 'the Uganda Registration Services Bureau', source: O('https://ursb.go.ug/') }),
  T.ngo('UG', { title: 'Non-Governmental Organisations Act, 2016', citation: 'Act of 2016', regulator: 'National Bureau for NGOs', source: icnl('uganda') }),
  T.data('UG', { title: 'Data Protection and Privacy Act, 2019', citation: 'Act of 2019', regulator: 'the Personal Data Protection Office', source: O('https://pdpo.go.ug/'), extra: 'Controllers and processors must register with the Office.' }),
  T.corruption('UG', { title: 'Anti-Corruption Act, 2009', citation: 'Act of 2009, as amended', regulator: 'the Inspectorate of Government', source: O('https://www.igg.go.ug/') }),
  T.aml('UG', { title: 'Anti-Money Laundering Act, 2013', citation: 'Act of 2013, as amended', regulator: 'the Financial Intelligence Authority', source: O('https://www.fia.go.ug/') }),
  T.procurement('UG', { title: 'Public Procurement and Disposal of Public Assets Act', citation: 'Act of 2003, as amended in 2021', regulator: 'the PPDA', source: O('https://www.ppda.go.ug/') }),
  T.govCode('UG', { title: 'Capital Markets (Corporate Governance) Guidelines', citation: 'Capital Markets Authority guidelines', regulator: 'Capital Markets Authority', source: O('https://cmauganda.co.ug/'), extra: 'Banks follow Bank of Uganda corporate governance regulations.' }),
  T.labour('UG', { title: 'Employment Act, 2006', citation: 'Act of 2006', regulator: 'Ministry of Gender, Labour and Social Development', source: ag('uganda') }),
  T.eia('UG', { title: 'National Environment Act and EIA regulations', citation: 'Act of 2019; EIA Regulations 2020', regulator: 'the National Environment Management Authority', source: O('https://www.nema.go.ug/') }),
  T.sustain('UG', { title: 'National Environment Act and Climate Change Act', citation: 'Act of 2019; Act of 2021', regulator: 'National Environment Management Authority; Ministry of Water and Environment', source: O('https://www.nema.go.ug/'), extra: 'The 2021 climate law sets duties on climate action plans and reporting.' }),
  T.bank('UG', { title: 'Financial Institutions Act', citation: 'Act of 2004, as amended', regulator: 'the Bank of Uganda', source: O('https://www.bou.or.ug/') }),
  T.accounting('UG', { title: 'Accountants Act and IFRS adoption', citation: 'Act of 2013', regulator: 'Institute of Certified Public Accountants of Uganda', source: O('https://www.icpau.co.ug/') }),
  T.securities('UG', { title: 'Capital Markets Authority Act', citation: 'As amended', regulator: 'the Capital Markets Authority, with listing on the Uganda Securities Exchange', source: O('https://cmauganda.co.ug/') }),

  // ---- Ethiopia ----
  T.company('ET', { title: 'Commercial Code', citation: 'Proclamation No. 1243/2021', regulator: 'Ministry of Trade and Regional Integration', source: ag('ethiopia') }),
  T.ngo('ET', { title: 'Organizations of Civil Society Proclamation', citation: 'Proclamation No. 1113/2019', regulator: 'Authority for Civil Society Organizations', source: icnl('ethiopia') }),
  T.data('ET', { title: 'Personal Data Protection Proclamation', citation: 'Proclamation No. 1321/2024', regulator: 'the Ethiopian Communications Authority', source: dla('ET') }),
  T.corruption('ET', { title: 'Corruption Crimes Proclamation', citation: 'Proclamation No. 881/2015', regulator: 'the Federal Ethics and Anti-Corruption Commission', source: ag('ethiopia') }),
  T.aml('ET', { title: 'Proclamation on prevention and suppression of money laundering and financing of terrorism', citation: 'Proclamation No. 780/2013, as amended', regulator: 'the Financial Intelligence Service', source: ag('ethiopia') }),
  T.procurement('ET', { title: 'Federal public procurement and property administration proclamation', citation: 'As amended', regulator: 'the Public Procurement and Property Authority', source: O('https://ppa.gov.et/') }),
  T.govNone('ET', { title: 'No national corporate governance code', citation: 'National Bank of Ethiopia governance directives for banks; Ethiopian Capital Market Authority rules for listed companies', regulator: 'National Bank of Ethiopia; Ethiopian Capital Market Authority', source: O('https://nbe.gov.et/') }),
  T.labour('ET', { title: 'Labour Proclamation', citation: 'Proclamation No. 1156/2019', regulator: 'Ministry of Labour and Skills', source: ag('ethiopia') }),
  T.eia('ET', { title: 'Environmental Impact Assessment Proclamation', citation: 'Proclamation No. 299/2002', regulator: 'the Environmental Protection Authority', source: leap('et') }),
  T.sustain('ET', { title: 'Environmental Pollution Control Proclamation', citation: 'Proclamation No. 300/2002', regulator: 'Environmental Protection Authority', source: leap('et') }),
  T.bank('ET', { title: 'Banking Business Proclamation', citation: 'As amended', regulator: 'the National Bank of Ethiopia', source: O('https://nbe.gov.et/'), extra: 'IFRS reporting is required by the Financial Reporting Proclamation No. 847/2014.' }),
  T.securities('ET', { title: 'Capital Market Proclamation', citation: 'Proclamation No. 1248/2021', regulator: 'the Ethiopian Capital Market Authority, with listing on the Ethiopian Securities Exchange', source: O('https://ecma.gov.et/') }),

  // ---- Madagascar ----
  T.company('MG', { title: 'Law on commercial companies', citation: 'Law No. 2003-036', regulator: 'Registre du commerce', source: ag('madagascar') }),
  T.ngo('MG', { title: 'Laws on associations and NGOs', citation: 'Ordinance No. 60-133; Law No. 96-030', regulator: 'Ministry of the Interior', source: icnl('madagascar') }),
  T.data('MG', { title: 'Law on the protection of personal data', citation: 'Law No. 2014-038', regulator: "the Commission Malagasy sur l'Informatique et les Libertés (CMIL)", source: dla('MG'), extra: 'Confirm whether the commission is fully operational.' }),
  T.corruption('MG', { title: 'Law on the fight against corruption', citation: 'Law No. 2016-020', regulator: 'BIANCO (Independent Anti-Corruption Bureau) and the anti-corruption courts', source: ag('madagascar') }),
  T.aml('MG', { title: 'Law on combating money laundering and terrorist financing', citation: 'Law No. 2018-043', regulator: 'SAMIFIN (financial intelligence unit)', source: ag('madagascar') }),
  T.procurement('MG', { title: 'Public Procurement Code', citation: 'Law No. 2016-055', regulator: "the Autorité de Régulation des Marchés Publics (ARMP)", source: ag('madagascar') }),
  T.govNone('MG', { title: 'No national corporate governance code', citation: 'Central Bank and banking supervision commission rules for banks', regulator: 'Banky Foiben\'i Madagasikara', source: O('https://www.banky-foibe.mg/') }),
  T.labour('MG', { title: 'Labour Code', citation: 'Law No. 2003-044, as amended', regulator: 'Labour inspectorate', source: ag('madagascar') }),
  T.eia('MG', { title: 'Decree on the compatibility of investments with the environment (MECIE)', citation: 'Decree No. 99-954, as amended', regulator: "the Office National pour l'Environnement", source: leap('mg') }),
  T.sustain('MG', { title: 'Environmental Charter', citation: 'Law No. 2015-003', regulator: 'Ministry of Environment', source: leap('mg') }),
  T.bank('MG', { title: 'Banking law', citation: 'Law No. 2020-011', regulator: "the Banky Foiben'i Madagasikara and the banking supervision commission", source: O('https://www.banky-foibe.mg/') }),
  T.noMarket('MG', { title: 'No stock exchange in operation', citation: 'Company and banking law apply to any public offer', regulator: null, source: ag('madagascar') }),

  // ---- Comoros (OHADA) ----
  R.ohadaCompany('KM'),
  R.syscohada('KM'),
  T.ngo('KM', { title: 'Law on associations', citation: 'As amended', regulator: 'Ministry of the Interior', source: icnl('comoros') }),
  T.noData('KM', { title: 'No data protection law', citation: 'No comprehensive law in force', regulator: null, source: dpa('comoros') }),
  T.aml('KM', { title: 'Law on combating money laundering and terrorist financing', citation: 'As amended', regulator: 'the financial intelligence unit', source: ag('comoros') }),
  T.procurement('KM', { title: 'Public Procurement Code', citation: 'As amended', regulator: 'the public procurement regulatory authority', source: ag('comoros') }),
  T.govNone('KM', { title: 'No national corporate governance code', citation: 'OHADA company law; Central Bank rules for banks', regulator: 'Banque Centrale des Comores', source: O('https://www.banque-comores.km/') }),
  T.labour('KM', { title: 'Labour Code', citation: 'As amended', regulator: 'Labour inspectorate', source: ag('comoros') }),
  T.eia('KM', { title: 'Framework Law on the Environment (EIA provisions)', citation: 'Law of 1994, as amended', regulator: 'the environment directorate', source: leap('km') }),
  T.sustain('KM', { title: 'Framework Law on the Environment', citation: 'Law of 1994, as amended', regulator: 'Environment directorate', source: leap('km') }),
  T.bank('KM', { title: 'Banking law and Central Bank regulations', citation: 'As amended', regulator: 'the Banque Centrale des Comores', source: O('https://www.banque-comores.km/') }),
  T.noMarket('KM', { title: 'No stock exchange or capital markets law', citation: 'Company and banking law apply to any public offer', regulator: null, source: ag('comoros') }),

  // ---- Djibouti ----
  T.company('DJ', { title: 'Commercial Code', citation: 'As amended', regulator: 'Office Djiboutien de la Propriété Industrielle et Commerciale', source: ag('djibouti') }),
  T.ngo('DJ', { title: 'Law on associations', citation: 'As amended', regulator: 'Ministry of the Interior', source: ag('djibouti') }),
  T.noData('DJ', { title: 'Data protection provisions in the Digital Code (status to confirm)', citation: 'Digital Code of 2025', regulator: null, source: dpa('djibouti'), extra: 'Provisions were reportedly enacted in 2025; whether they are in force and who supervises them is unclear.' }),
  T.aml('DJ', { title: 'Law on combating money laundering and terrorist financing', citation: 'As amended', regulator: 'the financial intelligence unit', source: ag('djibouti') }),
  T.procurement('DJ', { title: 'Public Procurement Code', citation: 'As amended', regulator: 'the public procurement authority', source: ag('djibouti') }),
  T.govNone('DJ', { title: 'No national corporate governance code', citation: 'Central Bank rules for banks', regulator: 'Banque Centrale de Djibouti', source: O('https://www.banque-centrale.dj/') }),
  T.labour('DJ', { title: 'Labour Code', citation: 'Law of 2006, as amended', regulator: 'Labour inspectorate', source: ag('djibouti') }),
  T.eia('DJ', { title: 'Framework Law on the Environment and EIA decree', citation: 'As amended', regulator: 'the environment directorate', source: leap('dj') }),
  T.sustain('DJ', { title: 'Framework Law on the Environment', citation: 'As amended', regulator: 'Ministry of Environment', source: leap('dj') }),
  T.bank('DJ', { title: 'Banking law and Central Bank regulations', citation: 'As amended', regulator: 'the Banque Centrale de Djibouti', source: O('https://www.banque-centrale.dj/') }),
  T.noMarket('DJ', { title: 'No stock exchange or capital markets law', citation: 'Company and banking law apply to any public offer', regulator: null, source: ag('djibouti') }),

  // ---- Eritrea ----
  T.company('ER', { title: 'Commercial Code (transitional)', citation: 'As amended', regulator: 'Ministry of Trade and Industry', source: ag('eritrea') }),
  T.ngo('ER', { title: 'Proclamation on the administration of NGOs', citation: 'Proclamation No. 145/2005', regulator: 'Ministry of Labour and Human Welfare', source: ag('eritrea'), extra: 'Operating space for NGOs is very restricted.' }),
  T.noData('ER', { title: 'No data protection law', citation: 'No comprehensive law in force', regulator: null, source: dpa('eritrea') }),
  T.aml('ER', { title: 'Proclamation on anti-money laundering and combating the financing of terrorism', citation: 'Proclamation No. 175/2014', regulator: 'the financial intelligence unit', source: ag('eritrea') }),
  T.procurement('ER', { title: 'Public procurement rules', citation: 'As amended', regulator: 'Ministry of Finance', source: ag('eritrea') }),
  T.govNone('ER', { title: 'No national corporate governance code', citation: 'Company and banking law', regulator: 'Bank of Eritrea', source: ag('eritrea') }),
  T.labour('ER', { title: 'Labour Proclamation', citation: 'Proclamation No. 118/2001', regulator: 'Ministry of Labour and Human Welfare', source: ag('eritrea') }),
  T.eia('ER', { title: 'Environmental Protection, Management and Rehabilitation Framework Proclamation', citation: 'Proclamation No. 179/2017', regulator: 'the Department of Environment', source: leap('er') }),
  T.sustain('ER', { title: 'Environmental Protection, Management and Rehabilitation Framework Proclamation', citation: 'Proclamation No. 179/2017', regulator: 'Department of Environment', source: leap('er') }),
  T.bank('ER', { title: 'Banking law', citation: 'As amended', regulator: 'the Bank of Eritrea', source: ag('eritrea') }),
  T.noMarket('ER', { title: 'No stock exchange or capital markets law', citation: 'Company and banking law apply to any public offer', regulator: null, source: ag('eritrea') }),

  // ---- Seychelles ----
  T.company('SC', { title: 'Companies Act and International Business Companies Act', citation: 'Companies Act 1972; International Business Companies Act 2016', regulator: 'Registrar General; Financial Services Authority (IBCs)', source: ag('seychelles') }),
  T.ngo('SC', { title: 'Registration of Associations Act', citation: 'As amended', regulator: 'Registrar of Associations', source: ag('seychelles') }),
  T.data('SC', { title: 'Data Protection Act, 2023', citation: 'Act 24 of 2023 (in force 22 December 2023)', regulator: 'the Information Commission', source: dla('SC') }),
  T.corruption('SC', { title: 'Anti-Corruption Act', citation: 'Act of 2016, as amended', regulator: 'the Anti-Corruption Commission Seychelles', source: ag('seychelles') }),
  T.aml('SC', { title: 'Anti-Money Laundering and Countering the Financing of Terrorism Act', citation: 'Act of 2020', regulator: 'the Financial Intelligence Unit', source: ag('seychelles') }),
  T.procurement('SC', { title: 'Public Procurement Act', citation: 'Act of 2008, as amended', regulator: 'the National Tender Board', source: ag('seychelles') }),
  T.govNone('SC', { title: 'No binding national corporate governance code', citation: 'Central Bank governance guidelines for banks; FSA rules for listed and licensed entities', regulator: 'Central Bank of Seychelles; Financial Services Authority', source: O('https://www.cbs.sc/') }),
  T.labour('SC', { title: 'Employment Act', citation: 'Act of 1995, as amended', regulator: 'Ministry of Employment', source: ag('seychelles') }),
  T.eia('SC', { title: 'Environment Protection Act (EIA provisions)', citation: 'Act of 2016', regulator: 'the Ministry of Environment', source: leap('sc') }),
  T.sustain('SC', { title: 'Environment Protection Act', citation: 'Act of 2016', regulator: 'Ministry of Environment', source: leap('sc') }),
  T.bank('SC', { title: 'Financial Institutions Act', citation: 'Act of 2004, as amended', regulator: 'the Central Bank of Seychelles', source: O('https://www.cbs.sc/') }),
  T.securities('SC', { title: 'Securities Act', citation: 'Act of 2007, as amended', regulator: 'the Financial Services Authority, with listing on the MERJ exchange', source: O('https://www.fsaseychelles.sc/') }),

  // ---- Somalia ----
  T.company('SO', { title: 'Company Act', citation: 'Act of 2019', regulator: 'Ministry of Commerce and Industry', source: ag('somalia') }),
  T.ngo('SO', { title: 'NGO registration rules', citation: 'As applied', regulator: 'Ministry of Planning, Investment and Economic Development', source: icnl('somalia') }),
  T.data('SO', { title: 'Data Protection Act', citation: 'Act No. 005 of 2023', regulator: 'the Data Protection Authority', source: dpa('somalia') }),
  T.aml('SO', { title: 'Anti-Money Laundering and Countering the Financing of Terrorism Act', citation: 'Act of 2016', regulator: 'the Financial Reporting Centre', source: ag('somalia') }),
  T.procurement('SO', { title: 'Public procurement law', citation: 'As amended', regulator: 'the national procurement authority', source: ag('somalia') }),
  T.govNone('SO', { title: 'No national corporate governance code', citation: 'Central Bank rules for banks', regulator: 'Central Bank of Somalia', source: O('https://centralbank.gov.so/') }),
  T.labour('SO', { title: 'Labour Code', citation: 'As amended', regulator: 'Ministry of Labour and Social Affairs', source: ag('somalia') }),
  T.eia('SO', { title: 'Environmental management law and EIA rules', citation: 'As amended', regulator: 'the federal environment authority', source: leap('so') }),
  T.sustain('SO', { title: 'Environmental management law', citation: 'As amended', regulator: 'Federal environment authority', source: leap('so') }),
  T.bank('SO', { title: 'Financial Institutions Law', citation: 'Law of 2012', regulator: 'the Central Bank of Somalia', source: O('https://centralbank.gov.so/') }),
  T.noMarket('SO', { title: 'No stock exchange or capital markets law in operation', citation: 'Company and banking law apply to any public offer', regulator: null, source: ag('somalia') }),

  // ---- South Sudan ----
  T.company('SS', { title: 'Companies Act', citation: 'Act of 2012', regulator: 'Ministry of Justice (Registrar General)', source: ag('south-sudan') }),
  T.ngo('SS', { title: 'Non-Governmental Organizations Act', citation: 'Act of 2016', regulator: 'Relief and Rehabilitation Commission', source: icnl('south-sudan') }),
  T.noData('SS', { title: 'No data protection law', citation: 'A data protection bill has been drafted', regulator: null, source: dpa('south-sudan') }),
  T.corruption('SS', { title: 'Anti-Corruption Commission Act', citation: 'Act of 2009', regulator: 'the South Sudan Anti-Corruption Commission', source: ag('south-sudan') }),
  T.aml('SS', { title: 'Anti-Money Laundering and Counter Terrorist Financing Act', citation: 'Act of 2012', regulator: 'the Financial Intelligence Unit', source: ag('south-sudan') }),
  T.procurement('SS', { title: 'Public Procurement and Disposal of Assets Act', citation: 'Act of 2018', regulator: 'the public procurement authority', source: ag('south-sudan') }),
  T.govNone('SS', { title: 'No national corporate governance code', citation: 'Bank of South Sudan rules for banks', regulator: 'Bank of South Sudan', source: O('https://boss.gov.ss/') }),
  T.labour('SS', { title: 'Labour Act', citation: 'Act of 2017', regulator: 'Ministry of Labour', source: ag('south-sudan') }),
  T.eia('SS', { title: 'Environmental protection legislation and EIA rules', citation: 'As amended', regulator: 'the Ministry of Environment and Forestry', source: leap('ss') }),
  T.sustain('SS', { title: 'Environmental protection legislation', citation: 'As amended', regulator: 'Ministry of Environment and Forestry', source: leap('ss') }),
  T.bank('SS', { title: 'Banking Act', citation: 'Act of 2012', regulator: 'the Bank of South Sudan', source: O('https://boss.gov.ss/') }),
  T.noMarket('SS', { title: 'No stock exchange or capital markets law', citation: 'Company and banking law apply to any public offer', regulator: null, source: ag('south-sudan') }),

  // ---- Sudan ----
  T.company('SD', { title: 'Companies Act', citation: 'Act of 2015', regulator: 'Registrar General of Commercial Registration', source: ag('sudan') }),
  T.ngo('SD', { title: 'Voluntary and Humanitarian Work (Organisation) Act', citation: 'Act of 2006', regulator: 'Humanitarian Aid Commission', source: icnl('sudan') }),
  T.noData('SD', { title: 'No comprehensive data protection law', citation: 'Limited rules in cybercrime and electronic transactions laws', regulator: null, source: dpa('sudan') }),
  T.aml('SD', { title: 'Money Laundering and Terrorist Financing Act', citation: 'Act of 2014, as amended', regulator: 'the Financial Information Unit', source: ag('sudan') }),
  T.procurement('SD', { title: 'Public Procurement, Contracting and Disposal of Public Assets Act', citation: 'Act of 2010', regulator: 'Ministry of Finance', source: ag('sudan') }),
  T.govNone('SD', { title: 'No national corporate governance code', citation: 'Central Bank of Sudan rules for banks', regulator: 'Central Bank of Sudan', source: O('https://cbos.gov.sd/') }),
  T.labour('SD', { title: 'Labour Act', citation: 'Act of 1997, as amended', regulator: 'Ministry of Labour', source: ag('sudan') }),
  T.eia('SD', { title: 'Environment Protection Act (EIA provisions)', citation: 'Act of 2001', regulator: 'the Higher Council for Environment and Natural Resources', source: leap('sd') }),
  T.sustain('SD', { title: 'Environment Protection Act', citation: 'Act of 2001', regulator: 'Higher Council for Environment and Natural Resources', source: leap('sd') }),
  T.bank('SD', { title: 'Banking Business (Organisation) Act', citation: 'Act of 2004, as amended', regulator: 'the Central Bank of Sudan', source: O('https://cbos.gov.sd/') }),
  T.securities('SD', { title: 'Khartoum Stock Exchange law', citation: 'As amended', regulator: 'the capital market regulator and Khartoum Stock Exchange', source: ag('sudan'), extra: 'Market operations have been disrupted by conflict; confirm current status.' }),
])
