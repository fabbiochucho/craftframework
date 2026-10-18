// Phase 2, West Africa: BJ, BF, CI, GM, GH, GN, GW, LR, ML, NE, SL, TG. Pending review.
// WAEMU members share OHADA company and accounting law, BCEAO banking rules, the WAEMU AML/CFT framework and the AMF-UMOA market.
import type { LawEntry } from '../types.ts'
import { finalize, O, R, S, T } from './helpers.ts'

const ag = (c: string) => S(`https://www.addleshawgoddard.com/en/doing-business-in-africa/africa-countries-a-z-list/${c}/`)
const leap = (c: string) => S(`https://leap.unep.org/en/countries/${c}`)
const dla = (c: string) => S(`https://www.dlapiperdataprotection.com/index.html?t=law&c=${c}`)
const dpa = (c: string) => S(`https://dataprotection.africa/${c}/`)
const icnl = (c: string) => S(`https://www.icnl.org/resources/civic-freedom-monitor/${c}`)
/** The regional pieces every WAEMU member shares. */
const waemu = (j: string) => [R.ohadaCompany(j), R.waemuAml(j), R.waemuGov(j), R.syscohada(j), R.waemuBank(j), R.waemuCapital(j)]

export const WEST_LAWS: LawEntry[] = finalize([
  // ---- Benin ----
  ...waemu('BJ'),
  T.ngo('BJ', { title: 'Law on associations (law of 1 July 1901, as applied)', citation: 'Law of 1901, with national implementing rules', regulator: 'Ministry of the Interior', source: icnl('benin') }),
  T.data('BJ', { title: 'Digital Code (Code du numérique), book on personal data protection', citation: 'Law No. 2017-20 of 20 April 2018', regulator: "the Autorité de Protection des Données à caractère Personnel (APDP)", source: O('https://apdp.bj/') }),
  T.corruption('BJ', { title: 'Law on the fight against corruption and related offences', citation: 'Law No. 2011-20', regulator: null, source: ag('benin') }),
  T.procurement('BJ', { title: 'Public Procurement Code', citation: 'Law No. 2020-26', regulator: "the Autorité de Régulation des Marchés Publics (ARMP)", source: ag('benin') }),
  T.labour('BJ', { title: 'Labour Code', citation: 'Law No. 98-004, as amended', regulator: 'Labour inspectorate', source: ag('benin') }),
  T.eia('BJ', { title: 'Framework Law on the Environment (environmental assessment provisions)', citation: 'Law No. 98-030, with implementing decrees', regulator: "the Agence Béninoise pour l'Environnement", source: leap('bj') }),
  T.sustain('BJ', { title: 'Framework Law on the Environment', citation: 'Law No. 98-030', regulator: 'Ministry of Living Environment and Sustainable Development', source: leap('bj') }),

  // ---- Burkina Faso ----
  ...waemu('BF'),
  T.ngo('BF', { title: 'Law on freedom of association', citation: 'Law No. 064-2015/CNT', regulator: 'Ministry of Territorial Administration', source: icnl('burkina-faso') }),
  T.data('BF', { title: 'Law on the protection of persons with regard to the processing of personal data', citation: 'Law No. 001-2021/AN', regulator: "the Commission de l'Informatique et des Libertés (CIL)", source: O('https://www.cil.bf/') }),
  T.corruption('BF', { title: 'Law on the prevention and repression of corruption', citation: 'Law No. 004-2015/CNT', regulator: "the Autorité Supérieure de Contrôle d'État et de Lutte contre la Corruption (ASCE-LC)", source: ag('burkina-faso') }),
  T.procurement('BF', { title: 'Law on the general rules of public procurement', citation: 'Law No. 039-2016/AN, with implementing decrees', regulator: 'the public procurement regulatory authority', source: ag('burkina-faso') }),
  T.labour('BF', { title: 'Labour Code', citation: 'Law No. 028-2008/AN, as amended', regulator: 'Labour inspectorate', source: ag('burkina-faso') }),
  T.eia('BF', { title: 'Environment Code (environmental assessment provisions)', citation: 'Law No. 006-2013/AN, with EIA decrees', regulator: "the Agence Nationale des Évaluations Environnementales", source: leap('bf') }),
  T.sustain('BF', { title: 'Environment Code', citation: 'Law No. 006-2013/AN', regulator: 'Ministry of Environment', source: leap('bf') }),

  // ---- Côte d'Ivoire ----
  ...waemu('CI'),
  T.ngo('CI', { title: 'Law on associations', citation: 'Law No. 60-315 of 1960, as amended', regulator: 'Ministry of the Interior', source: ag('ivory-coast') }),
  T.data('CI', { title: 'Law on the protection of personal data', citation: 'Law No. 2013-450 of 19 June 2013', regulator: "the Autorité de Régulation des Télécommunications/TIC de Côte d'Ivoire (ARTCI)", source: O('https://www.artci.ci/') }),
  T.corruption('CI', { title: 'Ordinance on the prevention and repression of corruption', citation: 'Ordinance No. 2013-660', regulator: 'the Haute Autorité pour la Bonne Gouvernance (HABG)', source: ag('ivory-coast') }),
  T.procurement('CI', { title: 'Public Procurement Code', citation: 'Ordinance No. 2019-679', regulator: "the Autorité Nationale de Régulation des Marchés Publics (ANRMP)", source: ag('ivory-coast') }),
  T.labour('CI', { title: 'Labour Code', citation: 'Law No. 2015-532', regulator: 'Labour inspectorate', source: ag('ivory-coast') }),
  T.eia('CI', { title: 'Environment Code and decree on environmental impact studies', citation: 'Law No. 96-766; Decree No. 96-894', regulator: "the Agence Nationale De l'Environnement (ANDE)", source: leap('ci') }),
  T.sustain('CI', { title: 'Environment Code', citation: 'Law No. 96-766, as amended', regulator: 'Ministry of Environment and Sustainable Development', source: leap('ci') }),

  // ---- The Gambia ----
  T.company('GM', { title: 'Companies Act', citation: 'Act of 2013', regulator: 'Ministry of Justice (Registrar of Companies)', source: ag('gambia') }),
  T.ngo('GM', { title: 'NGO Decree', citation: 'Decree No. 81 of 1996, as amended', regulator: 'NGO Affairs Agency', source: icnl('gambia') }),
  T.data('GM', { title: 'Personal Data Protection and Privacy Act', citation: 'Act of 2025', regulator: 'the Information Commission', source: dpa('the-gambia'), extra: 'Recently enacted; confirm commencement and implementing rules.' }),
  T.aml('GM', { title: 'Anti-Money Laundering and Combating of Terrorist Financing Act', citation: 'Act of 2012, as amended', regulator: 'the Financial Intelligence Unit', source: ag('gambia') }),
  T.procurement('GM', { title: 'Gambia Public Procurement Authority Act', citation: 'As amended', regulator: 'the Gambia Public Procurement Authority (GPPA)', source: O('https://www.gppa.gm/') }),
  T.govNone('GM', { title: 'No national corporate governance code', citation: 'Central Bank of The Gambia governance guidelines for banks', regulator: 'Central Bank of The Gambia', source: O('https://www.cbg.gm/') }),
  T.labour('GM', { title: 'Labour Act', citation: 'As amended', regulator: 'Department of Labour', source: ag('gambia') }),
  T.eia('GM', { title: 'National Environment Management Act and EIA regulations', citation: 'Act of 1994; EIA regulations', regulator: 'the National Environment Agency', source: leap('gm') }),
  T.sustain('GM', { title: 'National Environment Management Act', citation: 'Act of 1994', regulator: 'National Environment Agency', source: leap('gm') }),
  T.bank('GM', { title: 'Banking Act', citation: 'Act of 2009, as amended', regulator: 'the Central Bank of The Gambia', source: O('https://www.cbg.gm/') }),
  T.noMarket('GM', { title: 'No stock exchange or capital markets law', citation: 'Company and banking law apply to any public offer', regulator: null, source: ag('gambia') }),

  // ---- Ghana ----
  T.company('GH', { title: 'Companies Act, 2019', citation: 'Act 992', regulator: "the Office of the Registrar of Companies", source: ag('ghana'), extra: 'Non-profits commonly register as companies limited by guarantee.' }),
  T.ngo('GH', { title: 'Non-profit registration under company law and Social Welfare rules', citation: 'Companies Act 2019 (Act 992); Department of Social Welfare registration', regulator: 'Department of Social Welfare', source: icnl('ghana'), reformNote: 'A dedicated non-profit organisations law has been proposed; check its status.' }),
  { ...T.data('GH', { title: 'Data Protection Act, 2012', citation: 'Act 843', regulator: 'the Data Protection Commission', source: O('https://dataprotection.org.gh/'), extra: 'Every data controller must register with the Commission.' }) },
  T.aml('GH', { title: 'Anti-Money Laundering Act, 2020', citation: 'Act 1044', regulator: 'the Financial Intelligence Centre', source: O('https://fic.gov.gh/') }),
  T.corruption('GH', { title: 'Office of the Special Prosecutor Act, 2017', citation: 'Act 959', regulator: 'the Office of the Special Prosecutor', source: ag('ghana'), extra: 'Bribery offences are also in the Criminal Offences Act.' }),
  T.procurement('GH', { title: 'Public Procurement Act, 2003', citation: 'Act 663, as amended by Act 914 (2016)', regulator: 'the Public Procurement Authority', source: O('https://ppa.gov.gh/') }),
  T.govCode('GH', { title: 'Bank of Ghana Corporate Governance Directive', citation: 'Bank of Ghana, 2018', regulator: 'Bank of Ghana', source: O('https://www.bog.gov.gh/'), extra: 'Listed companies also follow the SEC corporate governance code for listed companies.' }),
  T.labour('GH', { title: 'Labour Act, 2003', citation: 'Act 651', regulator: 'National Labour Commission; Labour Department', source: ag('ghana') }),
  T.eia('GH', { title: 'Environmental Assessment Regulations', citation: 'L.I. 1652 (1999)', regulator: 'the Environmental Protection Authority', source: O('https://www.epa.gov.gh/'), reformNote: 'A new environmental protection law was passed in 2025; check commencement and any new assessment regulations.' }),
  T.sustain('GH', { title: 'Environmental protection law', citation: 'Environmental Protection Agency Act 1994 (Act 490), being replaced by the 2025 Act', regulator: 'Environmental Protection Authority', source: O('https://www.epa.gov.gh/') }),
  T.bank('GH', { title: 'Banks and Specialised Deposit-Taking Institutions Act, 2016', citation: 'Act 930', regulator: 'the Bank of Ghana', source: O('https://www.bog.gov.gh/') }),
  T.accounting('GH', { title: 'Chartered Accountants Act and IFRS adoption', citation: 'Act 1058 (2020)', regulator: 'Institute of Chartered Accountants, Ghana', source: O('https://icagh.org/'), extra: 'IFRS applies to public interest entities; ICAG has moved to adopt IFRS sustainability standards.' }),
  T.securities('GH', { title: 'Securities Industry Act, 2016', citation: 'Act 929', regulator: 'the Securities and Exchange Commission, with listing on the Ghana Stock Exchange', source: O('https://gse.com.gh/') }),

  // ---- Guinea (OHADA; not a WAEMU member) ----
  R.ohadaCompany('GN'),
  R.syscohada('GN'),
  T.ngo('GN', { title: 'Law on associations', citation: 'Law of 2005', regulator: 'Ministry of Territorial Administration', source: icnl('guinea') }),
  T.data('GN', { title: 'Law on cybersecurity and personal data protection', citation: 'Law L/2016/037/AN', regulator: null, source: dla('GN') }),
  T.corruption('GN', { title: 'Law on the prevention, detection and repression of corruption', citation: 'Law of 2017', regulator: null, source: ag('guinea') }),
  T.aml('GN', { title: 'Law on combating money laundering and terrorist financing', citation: 'As amended', regulator: 'the national CENTIF', source: ag('guinea') }),
  T.procurement('GN', { title: 'Public Procurement Code', citation: 'As amended', regulator: "the Autorité de Régulation des Marchés Publics (ARMP)", source: ag('guinea') }),
  T.govNone('GN', { title: 'No national corporate governance code', citation: 'OHADA company law; Central Bank governance rules for banks', regulator: 'Banque Centrale de la République de Guinée', source: O('https://www.bcrg-guinee.org/') }),
  T.labour('GN', { title: 'Labour Code', citation: 'Law of 2014', regulator: 'Labour inspectorate', source: ag('guinea') }),
  T.eia('GN', { title: 'Environment Code (environmental assessment provisions)', citation: 'As amended', regulator: 'the national environmental assessment agency', source: leap('gn') }),
  T.sustain('GN', { title: 'Environment Code', citation: 'As amended', regulator: 'Ministry of Environment', source: leap('gn') }),
  T.bank('GN', { title: 'Banking law and Central Bank regulations', citation: 'As amended', regulator: 'the Banque Centrale de la République de Guinée', source: O('https://www.bcrg-guinee.org/') }),
  T.noMarket('GN', { title: 'No stock exchange or capital markets law in operation', citation: 'Company and banking law apply to any public offer', regulator: null, source: ag('guinea') }),

  // ---- Guinea-Bissau ----
  ...waemu('GW'),
  T.ngo('GW', { title: 'Law on associations', citation: 'As amended', regulator: 'Ministry of the Interior', source: ag('guinea-bissau') }),
  T.noData('GW', { title: 'No data protection law', citation: 'ECOWAS Supplementary Act on personal data (regional)', regulator: null, source: dpa('guinea-bissau') }),
  T.procurement('GW', { title: 'Public Procurement Code', citation: 'As amended', regulator: 'the public procurement regulatory authority', source: ag('guinea-bissau') }),
  T.labour('GW', { title: 'Labour law (Lei Geral do Trabalho)', citation: 'As amended', regulator: 'Labour inspectorate', source: ag('guinea-bissau') }),
  T.eia('GW', { title: 'Law on environmental assessment', citation: 'Law of 2010', regulator: "the Autoridade de Avaliação Ambiental Competente", source: leap('gw') }),
  T.sustain('GW', { title: 'Framework Law on the Environment', citation: 'As amended', regulator: 'Ministry of Environment', source: leap('gw') }),

  // ---- Liberia ----
  T.company('LR', { title: 'Associations Law (Business Corporation Act and related titles)', citation: 'Title 5, Liberian Code of Laws Revised, as amended', regulator: 'the Liberia Business Registry', source: ag('liberia') }),
  T.ngo('LR', { title: 'Not-for-profit incorporation and NGO accreditation', citation: 'Associations Law; national NGO policy', regulator: 'Ministry of Finance and Development Planning (NGO accreditation)', source: icnl('liberia') }),
  T.noData('LR', { title: 'No comprehensive data protection law', citation: 'ECOWAS Supplementary Act on personal data (regional)', regulator: null, source: dla('LR') }),
  T.corruption('LR', { title: 'Act establishing the Liberia Anti-Corruption Commission', citation: 'Act of 2008, as amended', regulator: 'the Liberia Anti-Corruption Commission', source: ag('liberia') }),
  T.aml('LR', { title: 'Anti-Money Laundering and Terrorist Financing Act', citation: 'Act of 2012, as amended', regulator: 'the Financial Intelligence Agency', source: ag('liberia') }),
  T.procurement('LR', { title: 'Public Procurement and Concessions Act', citation: 'Act of 2005, as amended in 2010', regulator: 'the Public Procurement and Concessions Commission', source: O('https://ppcc.gov.lr/') }),
  T.govNone('LR', { title: 'No national corporate governance code', citation: 'Central Bank of Liberia corporate governance regulations for banks', regulator: 'Central Bank of Liberia', source: O('https://www.cbl.org.lr/') }),
  T.labour('LR', { title: 'Decent Work Act', citation: 'Act of 2015', regulator: 'Ministry of Labour', source: ag('liberia') }),
  T.eia('LR', { title: 'Environment Protection and Management Law (EIA provisions)', citation: 'Act of 2003', regulator: 'the Environmental Protection Agency', source: O('https://www.epa.gov.lr/') }),
  T.sustain('LR', { title: 'Environment Protection and Management Law', citation: 'Act of 2003', regulator: 'Environmental Protection Agency', source: O('https://www.epa.gov.lr/') }),
  T.bank('LR', { title: 'Financial Institutions Act', citation: 'Act of 1999, as amended', regulator: 'the Central Bank of Liberia', source: O('https://www.cbl.org.lr/') }),
  T.noMarket('LR', { title: 'No stock exchange or capital markets law in operation', citation: 'Company and banking law apply to any public offer', regulator: null, source: ag('liberia') }),

  // ---- Mali ----
  ...waemu('ML'),
  T.ngo('ML', { title: 'Law on associations', citation: 'Law No. 04-038 of 2004', regulator: 'Ministry of Territorial Administration', source: icnl('mali') }),
  T.data('ML', { title: 'Law on the protection of personal data', citation: 'Law No. 2013-015 of 21 May 2013', regulator: "the Autorité de Protection des Données à caractère Personnel (APDP)", source: dpa('mali') }),
  T.corruption('ML', { title: 'Law on illicit enrichment', citation: 'Law of 2014', regulator: "the Office Central de Lutte contre l'Enrichissement Illicite (OCLEI)", source: ag('mali') }),
  T.procurement('ML', { title: 'Public Procurement Code', citation: 'Decree of 2015, as amended', regulator: "the Autorité de Régulation des Marchés Publics et des Délégations de Service Public (ARMDS)", source: ag('mali') }),
  T.labour('ML', { title: 'Labour Code', citation: 'Law No. 92-020, as amended', regulator: 'Labour inspectorate', source: ag('mali') }),
  T.eia('ML', { title: 'Decree on environmental and social impact assessment', citation: 'Decree of 2018', regulator: "the Direction Nationale de l'Assainissement et du Contrôle des Pollutions et des Nuisances", source: leap('ml') }),
  T.sustain('ML', { title: 'Environmental protection and pollution control law', citation: 'As amended', regulator: 'Ministry of Environment', source: leap('ml') }),

  // ---- Niger ----
  ...waemu('NE'),
  T.ngo('NE', { title: 'Ordinance on associations', citation: 'Ordinance No. 84-06 of 1984, as amended', regulator: 'Ministry of the Interior', source: icnl('niger') }),
  T.data('NE', { title: 'Law on the protection of personal data', citation: 'Law No. 2017-28, as amended in 2019', regulator: "the Haute Autorité de Protection des Données à caractère Personnel (HAPDP)", source: dla('NE') }),
  T.corruption('NE', { title: 'Law establishing the High Authority against Corruption', citation: 'Law of 2016', regulator: 'the Haute Autorité de Lutte contre la Corruption et les Infractions Assimilées (HALCIA)', source: ag('niger') }),
  T.procurement('NE', { title: 'Public Procurement Code', citation: 'Decree of 2016, as amended', regulator: "the Agence de Régulation des Marchés Publics (ARMP)", source: ag('niger') }),
  T.labour('NE', { title: 'Labour Code', citation: 'Ordinance of 2012, as amended', regulator: 'Labour inspectorate', source: ag('niger') }),
  T.eia('NE', { title: 'Law on environmental assessment', citation: 'Law of 2018', regulator: "the Bureau National d'Évaluation Environnementale", source: leap('ne') }),
  T.sustain('NE', { title: 'Framework Law on environmental management', citation: 'As amended', regulator: 'Ministry of Environment', source: leap('ne') }),

  // ---- Sierra Leone ----
  T.company('SL', { title: 'Companies Act', citation: 'As amended', regulator: 'the Corporate Affairs Commission', source: ag('sierra-leone') }),
  T.ngo('SL', { title: 'NGO registration under the Development Cooperation Framework and NGO policy', citation: 'National NGO policy, as updated', regulator: 'Ministry of Planning and Economic Development', source: icnl('sierra-leone') }),
  T.noData('SL', { title: 'No data protection law', citation: 'Limited rules for telecoms operators in the Telecommunications Act 2006', regulator: null, source: dpa('sierra-leone') }),
  T.corruption('SL', { title: 'Anti-Corruption Act', citation: 'Act of 2008, as amended in 2019', regulator: 'the Anti-Corruption Commission', source: O('https://www.anticorruption.gov.sl/') }),
  T.aml('SL', { title: 'Anti-money laundering and combating terrorist financing law', citation: 'As amended', regulator: 'the Financial Intelligence Agency', source: ag('sierra-leone') }),
  T.procurement('SL', { title: 'Public Procurement Act', citation: 'Act of 2016', regulator: 'the National Public Procurement Authority', source: O('https://www.nppa.gov.sl/') }),
  T.govNone('SL', { title: 'No binding national corporate governance code', citation: 'Bank of Sierra Leone governance rules for banks; company law for others', regulator: 'Bank of Sierra Leone', source: ag('sierra-leone') }),
  T.labour('SL', { title: 'Employment Act', citation: 'Act of 2023', regulator: 'Ministry of Employment, Labour and Social Security', source: ag('sierra-leone') }),
  T.eia('SL', { title: 'Environment Protection Agency Act (EIA licensing)', citation: 'Act of 2022', regulator: 'the Environment Protection Agency', source: O('https://epa.gov.sl/') }),
  T.sustain('SL', { title: 'Environment Protection Agency Act', citation: 'Act of 2022', regulator: 'Environment Protection Agency', source: O('https://epa.gov.sl/') }),
  T.bank('SL', { title: 'Banking Act', citation: 'Act of 2019', regulator: 'the Bank of Sierra Leone', source: ag('sierra-leone') }),
  T.securities('SL', { title: 'Securities law and Sierra Leone Stock Exchange rules', citation: 'As amended', regulator: 'the Bank of Sierra Leone and the Sierra Leone Stock Exchange', source: ag('sierra-leone'), extra: 'The market is small; confirm the current securities framework.' }),

  // ---- Togo ----
  ...waemu('TG'),
  T.ngo('TG', { title: 'Law on associations (law of 1 July 1901, as applied)', citation: 'Law of 1901, with national implementing rules', regulator: 'Ministry of Territorial Administration', source: icnl('togo') }),
  T.data('TG', { title: 'Law on the protection of personal data', citation: 'Law of 29 October 2019', regulator: 'the national personal data protection authority (IPDCP)', source: dpa('togo') }),
  T.corruption('TG', { title: 'Law establishing the High Authority for the Prevention and Fight against Corruption', citation: 'Law of 2015', regulator: 'the Haute Autorité de Prévention et de Lutte contre la Corruption et les Infractions Assimilées (HAPLUCIA)', source: ag('togo') }),
  T.procurement('TG', { title: 'Public Procurement Code', citation: 'Law of 2021', regulator: 'the public procurement regulatory authority', source: ag('togo') }),
  T.labour('TG', { title: 'Labour Code', citation: 'Law of 2021', regulator: 'Labour inspectorate', source: ag('togo') }),
  T.eia('TG', { title: 'Framework Law on the Environment and decree on impact studies', citation: 'Law No. 2008-005, with implementing decrees', regulator: "the Agence Nationale de Gestion de l'Environnement (ANGE)", source: leap('tg') }),
  T.sustain('TG', { title: 'Framework Law on the Environment', citation: 'Law No. 2008-005', regulator: 'Ministry of Environment', source: leap('tg') }),
])
