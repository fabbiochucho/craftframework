// Phase 2, Southern Africa: AO, BW, SZ, LS, MW, MZ, NA, ZM, ZW. Pending review. Portuguese titles glossed in English.
import type { LawEntry } from '../types.ts'
import { finalize, O, S, T } from './helpers.ts'

const ag = (c: string) => S(`https://www.addleshawgoddard.com/en/doing-business-in-africa/africa-countries-a-z-list/${c}/`)
const leap = (c: string) => S(`https://leap.unep.org/en/countries/${c}`)
const dla = (c: string) => S(`https://www.dlapiperdataprotection.com/index.html?t=law&c=${c}`)
const icnl = (c: string) => S(`https://www.icnl.org/resources/civic-freedom-monitor/${c}`)

export const SOUTHERN_LAWS: LawEntry[] = finalize([
  // ---- Angola ----
  T.company('AO', { title: 'Lei das Sociedades Comerciais (Commercial Companies Law)', citation: 'Lei n.º 1/04, as amended', regulator: 'Guiché Único da Empresa (company registration)', source: ag('angola') }),
  T.ngo('AO', { title: 'Law on associations and NGO regulations', citation: 'Lei n.º 6/12; NGO regulations of 2015', regulator: 'Instituto de Promoção e Coordenação da Ajuda às Comunidades (IPROCAC)', source: icnl('angola') }),
  T.data('AO', { title: 'Lei da Proteção de Dados Pessoais (Personal Data Protection Law)', citation: 'Lei n.º 22/11', regulator: "the Agência de Proteção de Dados (APD)", source: dla('AO'), extra: 'Processing must be notified to or authorised by the APD.' }),
  T.corruption('AO', { title: 'Lei da Probidade Pública (Public Probity Law)', citation: 'Lei n.º 3/10', regulator: null, source: ag('angola') }),
  T.aml('AO', { title: 'Law on preventing and combating money laundering, terrorist financing and proliferation', citation: 'Lei n.º 5/20', regulator: "the Unidade de Informação Financeira (UIF)", source: ag('angola') }),
  T.procurement('AO', { title: 'Lei dos Contratos Públicos (Public Contracts Law)', citation: 'Lei n.º 41/20', regulator: 'the Serviço Nacional da Contratação Pública', source: ag('angola') }),
  T.govNone('AO', { title: 'No national corporate governance code', citation: 'Banco Nacional de Angola governance rules for banks; CMC rules for issuers', regulator: 'Banco Nacional de Angola; Comissão do Mercado de Capitais', source: O('https://www.bna.ao/') }),
  T.labour('AO', { title: 'Lei Geral do Trabalho (General Labour Law)', citation: 'Lei n.º 12/23', regulator: 'Inspecção Geral do Trabalho', source: ag('angola') }),
  T.eia('AO', { title: 'Regulation on environmental impact assessment and environmental licensing', citation: 'Presidential decree of 2020', regulator: 'the environment ministry', source: leap('ao') }),
  T.sustain('AO', { title: 'Lei de Bases do Ambiente (Framework Law on the Environment)', citation: 'Lei n.º 5/98', regulator: 'Ministry of Environment', source: leap('ao') }),
  T.bank('AO', { title: 'Lei de Bases das Instituições Financeiras (Financial Institutions Law)', citation: 'Lei n.º 14/21', regulator: 'the Banco Nacional de Angola', source: O('https://www.bna.ao/') }),
  T.securities('AO', { title: 'Código de Valores Mobiliários (Securities Code)', citation: 'Lei n.º 22/15', regulator: 'the Comissão do Mercado de Capitais, with trading on BODIVA', source: O('https://www.cmc.ao/') }),

  // ---- Botswana ----
  T.company('BW', { title: 'Companies Act', citation: 'Cap. 42:01 (2003), as amended', regulator: 'the Companies and Intellectual Property Authority', source: O('https://www.cipa.co.bw/') }),
  T.ngo('BW', { title: 'Societies Act', citation: 'Cap. 18:01', regulator: 'Registrar of Societies', source: icnl('botswana') }),
  T.data('BW', { title: 'Data Protection Act, 2024', citation: 'Act of 2024 (replaced the 2018 Act)', regulator: 'the Information and Data Protection Commission', source: dla('BW') }),
  T.corruption('BW', { title: 'Corruption and Economic Crime Act', citation: 'Cap. 08:05', regulator: 'the Directorate on Corruption and Economic Crime', source: ag('botswana') }),
  T.aml('BW', { title: 'Financial Intelligence Act', citation: 'Act of 2022', regulator: 'the Financial Intelligence Agency', source: O('https://www.fia.org.bw/') }),
  T.procurement('BW', { title: 'Public Procurement Act', citation: 'Act of 2021', regulator: 'the Public Procurement Regulatory Authority', source: ag('botswana') }),
  T.govNone('BW', { title: 'No standalone statutory code', citation: 'Botswana Stock Exchange listing requirements (corporate governance); Bank of Botswana guidelines for banks', regulator: 'Botswana Stock Exchange; Bank of Botswana', source: O('https://www.bse.co.bw/') }),
  T.labour('BW', { title: 'Employment Act', citation: 'Cap. 47:01, as amended', regulator: 'Department of Labour', source: ag('botswana') }),
  T.eia('BW', { title: 'Environmental Assessment Act', citation: 'Act of 2011', regulator: 'the Department of Environmental Protection', source: leap('bw') }),
  T.sustain('BW', { title: 'Environmental Assessment Act and environmental management laws', citation: 'Act of 2011', regulator: 'Department of Environmental Protection', source: leap('bw') }),
  T.bank('BW', { title: 'Banking Act', citation: 'Cap. 46:04', regulator: 'the Bank of Botswana', source: O('https://www.bankofbotswana.bw/'), extra: 'Non-bank financial institutions are supervised by NBFIRA.' }),
  T.securities('BW', { title: 'Securities Act', citation: 'Act of 2014', regulator: 'NBFIRA, with listing on the Botswana Stock Exchange', source: O('https://www.bse.co.bw/') }),

  // ---- Eswatini ----
  T.company('SZ', { title: 'Companies Act', citation: 'Act of 2009', regulator: 'Registrar of Companies', source: ag('swaziland') }),
  T.ngo('SZ', { title: 'Non-profit companies and associations (no dedicated NGO law)', citation: 'Companies Act 2009 (not-for-gain companies)', regulator: 'Registrar of Companies', source: icnl('swaziland') }),
  T.data('SZ', { title: 'Data Protection Act, 2022', citation: 'Act of 2022', regulator: 'the Eswatini Communications Commission', source: O('https://www.esccom.org.sz/') }),
  T.corruption('SZ', { title: 'Prevention of Corruption Act', citation: 'Act of 2006', regulator: 'the Anti-Corruption Commission', source: ag('swaziland') }),
  T.aml('SZ', { title: 'Money Laundering and Financing of Terrorism (Prevention) Act', citation: 'Act of 2011, as amended', regulator: 'the Eswatini Financial Intelligence Unit', source: ag('swaziland') }),
  T.procurement('SZ', { title: 'Public Procurement Act', citation: 'Act of 2011', regulator: 'the Eswatini Public Procurement Regulatory Agency', source: O('https://www.esppra.co.sz/') }),
  T.govNone('SZ', { title: 'No national corporate governance code', citation: 'Central Bank of Eswatini governance rules for banks; FSRA rules for listed entities', regulator: 'Central Bank of Eswatini; FSRA', source: O('https://www.centralbank.org.sz/') }),
  T.labour('SZ', { title: 'Employment Act', citation: 'Act of 1980, as amended', regulator: 'Ministry of Labour and Social Security', source: ag('swaziland') }),
  T.eia('SZ', { title: 'Environment Management Act and environmental audit, assessment and review regulations', citation: 'Act of 2002', regulator: 'the Eswatini Environment Authority', source: leap('sz') }),
  T.sustain('SZ', { title: 'Environment Management Act', citation: 'Act of 2002', regulator: 'Eswatini Environment Authority', source: leap('sz') }),
  T.bank('SZ', { title: 'Financial Institutions Act', citation: 'Act of 2005', regulator: 'the Central Bank of Eswatini', source: O('https://www.centralbank.org.sz/') }),
  T.securities('SZ', { title: 'Securities Act', citation: 'Act of 2010', regulator: 'the Financial Services Regulatory Authority, with listing on the Eswatini Stock Exchange', source: O('https://www.fsra.co.sz/') }),

  // ---- Lesotho ----
  T.company('LS', { title: 'Companies Act', citation: 'Act of 2011', regulator: 'Registrar of Companies', source: ag('lesotho') }),
  T.ngo('LS', { title: 'Societies Act', citation: 'Act of 1966', regulator: 'Registrar of Societies', source: icnl('lesotho') }),
  T.data('LS', { title: 'Data Protection Act, 2011', citation: 'Act of 2011', regulator: null, source: dla('LS'), extra: 'The Data Protection Commission provided for by the Act has not been established; confirm current practice.' }),
  T.corruption('LS', { title: 'Prevention of Corruption and Economic Offences Act', citation: 'Act of 1999, as amended', regulator: 'the Directorate on Corruption and Economic Offences', source: ag('lesotho') }),
  T.aml('LS', { title: 'Money Laundering and Proceeds of Crime Act', citation: 'Act of 2008, as amended', regulator: 'the Financial Intelligence Unit', source: ag('lesotho') }),
  T.procurement('LS', { title: 'Public Procurement Regulations', citation: 'Regulations of 2007', regulator: 'Ministry of Finance (Procurement Policy and Advice Division)', source: ag('lesotho') }),
  T.govNone('LS', { title: 'No national corporate governance code', citation: 'Central Bank of Lesotho rules for banks', regulator: 'Central Bank of Lesotho', source: ag('lesotho') }),
  T.labour('LS', { title: 'Labour Code Order', citation: 'Order of 1992, as amended', regulator: 'Ministry of Labour and Employment', source: ag('lesotho') }),
  T.eia('LS', { title: 'Environment Act (EIA provisions)', citation: 'Act of 2008', regulator: 'the Department of Environment', source: leap('ls') }),
  T.sustain('LS', { title: 'Environment Act', citation: 'Act of 2008', regulator: 'Department of Environment', source: leap('ls') }),
  T.bank('LS', { title: 'Financial Institutions Act', citation: 'Act of 2012', regulator: 'the Central Bank of Lesotho', source: ag('lesotho') }),
  T.securities('LS', { title: 'Capital markets regulations', citation: 'As amended', regulator: 'the Central Bank of Lesotho, with listing on the Maseru Securities Market', source: ag('lesotho') }),

  // ---- Malawi ----
  T.company('MW', { title: 'Companies Act', citation: 'Act of 2013', regulator: 'Registrar General', source: ag('malawi') }),
  T.ngo('MW', { title: 'Non-Governmental Organisations Act', citation: 'Act of 2001, as amended in 2022', regulator: 'NGO Regulatory Authority', source: icnl('malawi') }),
  T.data('MW', { title: 'Data Protection Act, 2024', citation: 'Act of 2024', regulator: 'the Malawi Communications Regulatory Authority (MACRA)', source: O('https://www.macra.mw/') }),
  T.corruption('MW', { title: 'Corrupt Practices Act', citation: 'Act of 1995, as amended', regulator: 'the Anti-Corruption Bureau', source: ag('malawi') }),
  T.aml('MW', { title: 'Financial Crimes Act', citation: 'Act of 2017', regulator: 'the Financial Intelligence Authority', source: ag('malawi') }),
  T.procurement('MW', { title: 'Public Procurement and Disposal of Public Assets Act', citation: 'Act of 2017', regulator: 'the Public Procurement and Disposal of Assets Authority', source: O('https://www.ppda.mw/') }),
  T.govCode('MW', { title: 'Code of Best Practice for Corporate Governance in Malawi (Malawi Code II)', citation: 'Institute of Directors Malawi, 2010', regulator: 'Institute of Directors Malawi; Reserve Bank of Malawi for banks', source: ag('malawi') }),
  T.labour('MW', { title: 'Employment Act', citation: 'Act of 2000, as amended', regulator: 'Ministry of Labour', source: ag('malawi') }),
  T.eia('MW', { title: 'Environment Management Act (EIA provisions)', citation: 'Act of 2017', regulator: 'the Malawi Environment Protection Authority', source: leap('mw') }),
  T.sustain('MW', { title: 'Environment Management Act', citation: 'Act of 2017', regulator: 'Malawi Environment Protection Authority', source: leap('mw') }),
  T.bank('MW', { title: 'Financial Services Act and Banking Act', citation: 'Acts of 2010', regulator: 'the Reserve Bank of Malawi', source: O('https://www.rbm.mw/') }),
  T.securities('MW', { title: 'Securities Act', citation: 'Act of 2010', regulator: 'the Reserve Bank of Malawi, with listing on the Malawi Stock Exchange', source: O('https://mse.co.mw/') }),

  // ---- Mozambique ----
  T.company('MZ', { title: 'Código Comercial (Commercial Code)', citation: 'Decree-Law of 2022', regulator: 'Conservatória do Registo das Entidades Legais', source: ag('mozambique') }),
  T.ngo('MZ', { title: 'Law on associations', citation: 'Lei n.º 8/91', regulator: 'Ministry of Justice', source: icnl('mozambique') }),
  T.noData('MZ', { title: 'No comprehensive data protection law', citation: 'Limited rules in the Electronic Transactions Law (Lei n.º 3/2017)', regulator: null, source: dla('MZ') }),
  T.corruption('MZ', { title: 'Anti-corruption law and Penal Code corruption offences', citation: 'Lei n.º 6/2004, as amended', regulator: 'the Gabinete Central de Combate à Corrupção', source: ag('mozambique') }),
  T.aml('MZ', { title: 'Law on preventing and combating money laundering, terrorist financing and proliferation', citation: 'Law of 2022', regulator: "the Gabinete de Informação Financeira de Moçambique (GIFiM)", source: ag('mozambique') }),
  T.procurement('MZ', { title: 'Public procurement regulation', citation: 'Decree of 2022', regulator: 'Ministry of Economy and Finance', source: ag('mozambique') }),
  T.govNone('MZ', { title: 'No binding national corporate governance code', citation: 'Banco de Moçambique governance rules for banks; stock exchange rules for listed companies', regulator: 'Banco de Moçambique', source: O('https://www.bancomoc.mz/') }),
  T.labour('MZ', { title: 'Lei do Trabalho (Labour Law)', citation: 'Law of 2023', regulator: 'Inspecção-Geral do Trabalho', source: ag('mozambique') }),
  T.eia('MZ', { title: 'Regulation on the environmental impact assessment process', citation: 'Decree of 2015', regulator: 'the environment ministry', source: leap('mz') }),
  T.sustain('MZ', { title: 'Lei do Ambiente (Environment Law)', citation: 'Lei n.º 20/97', regulator: 'Ministry of Land and Environment', source: leap('mz') }),
  T.bank('MZ', { title: 'Law on credit institutions and financial companies', citation: 'Law of 2020', regulator: 'the Banco de Moçambique', source: O('https://www.bancomoc.mz/') }),
  T.securities('MZ', { title: 'Securities market code', citation: 'As amended', regulator: 'the Banco de Moçambique, with listing on the Bolsa de Valores de Moçambique', source: O('https://www.bvm.co.mz/') }),

  // ---- Namibia ----
  T.company('NA', { title: 'Companies Act', citation: 'Act 28 of 2004', regulator: 'the Business and Intellectual Property Authority', source: O('https://www.bipa.na/') }),
  T.ngo('NA', { title: 'Section 21 not-for-gain companies, trusts and voluntary associations', citation: 'Companies Act 28 of 2004 and common law', regulator: 'Business and Intellectual Property Authority', source: icnl('namibia') }),
  T.noData('NA', { title: 'No comprehensive data protection law', citation: 'A Data Protection Bill (2021 draft) has not been enacted', regulator: null, source: dla('NA') }),
  T.corruption('NA', { title: 'Anti-Corruption Act', citation: 'Act 8 of 2003', regulator: 'the Anti-Corruption Commission', source: ag('namibia') }),
  T.aml('NA', { title: 'Financial Intelligence Act', citation: 'Act 13 of 2012, as amended', regulator: 'the Financial Intelligence Centre', source: O('https://www.fic.na/') }),
  T.procurement('NA', { title: 'Public Procurement Act', citation: 'Act 15 of 2015', regulator: 'the Central Procurement Board of Namibia and Procurement Policy Unit', source: O('https://www.cpbn.com.na/') }),
  T.govCode('NA', { title: 'Corporate Governance Code for Namibia (NamCode)', citation: 'NamCode, 2014', regulator: 'Namibian Stock Exchange (applies to listed companies)', source: ag('namibia') }),
  T.labour('NA', { title: 'Labour Act', citation: 'Act 11 of 2007', regulator: 'Ministry of Labour, Industrial Relations and Employment Creation', source: ag('namibia') }),
  T.eia('NA', { title: 'Environmental Management Act', citation: 'Act 7 of 2007, with EIA regulations', regulator: "the Environmental Commissioner", source: leap('na') }),
  T.sustain('NA', { title: 'Environmental Management Act', citation: 'Act 7 of 2007', regulator: 'Ministry of Environment, Forestry and Tourism', source: leap('na') }),
  T.bank('NA', { title: 'Banking Institutions Act', citation: 'Act of 2023', regulator: 'the Bank of Namibia', source: O('https://www.bon.com.na/') }),
  T.securities('NA', { title: 'Financial Institutions and Markets Act', citation: 'Act 2 of 2021', regulator: 'NAMFISA, with listing on the Namibian Stock Exchange', source: O('https://www.namfisa.com.na/') }),

  // ---- Zambia ----
  T.company('ZM', { title: 'Companies Act', citation: 'Act No. 10 of 2017', regulator: 'the Patents and Companies Registration Agency', source: O('https://www.pacra.org.zm/') }),
  T.ngo('ZM', { title: 'Non-Governmental Organisations Act', citation: 'Act of 2009, as amended', regulator: 'Registrar of NGOs', source: icnl('zambia'), reformNote: 'Replacement NGO legislation has been proposed; check its status.' }),
  T.data('ZM', { title: 'Data Protection Act', citation: 'Act No. 3 of 2021', regulator: 'the Office of the Data Protection Commissioner', source: O('https://www.dataprotection.gov.zm/'), extra: 'Controllers and processors must register with the Commissioner.' }),
  T.corruption('ZM', { title: 'Anti-Corruption Act', citation: 'Act No. 3 of 2012', regulator: 'the Anti-Corruption Commission', source: ag('zambia') }),
  T.aml('ZM', { title: 'Financial Intelligence Centre Act and anti-money laundering law', citation: 'Act of 2010, as amended; Prohibition and Prevention of Money Laundering Act 2001', regulator: 'the Financial Intelligence Centre', source: O('https://www.fic.gov.zm/') }),
  T.procurement('ZM', { title: 'Public Procurement Act', citation: 'Act No. 8 of 2020', regulator: 'the Zambia Public Procurement Authority', source: O('https://www.zppa.org.zm/') }),
  T.govCode('ZM', { title: 'Lusaka Securities Exchange corporate governance code', citation: 'LuSE code for listed companies', regulator: 'Lusaka Securities Exchange; Bank of Zambia for banks', source: O('https://www.luse.co.zm/') }),
  T.labour('ZM', { title: 'Employment Code Act', citation: 'Act No. 3 of 2019', regulator: 'Ministry of Labour and Social Security', source: ag('zambia') }),
  T.eia('ZM', { title: 'Environmental Management Act and EIA regulations', citation: 'Act No. 12 of 2011', regulator: 'the Zambia Environmental Management Agency', source: O('https://www.zema.org.zm/') }),
  T.sustain('ZM', { title: 'Environmental Management Act and green economy and climate change law', citation: 'Act No. 12 of 2011; climate change Act of 2024', regulator: 'Zambia Environmental Management Agency; Ministry of Green Economy and Environment', source: O('https://www.zema.org.zm/'), extra: 'The 2024 climate law sets duties on climate action and carbon markets.' }),
  T.bank('ZM', { title: 'Banking and Financial Services Act', citation: 'Act No. 7 of 2017', regulator: 'the Bank of Zambia', source: O('https://www.boz.zm/') }),
  T.securities('ZM', { title: 'Securities Act', citation: 'Act No. 41 of 2016', regulator: 'the Securities and Exchange Commission, with listing on the Lusaka Securities Exchange', source: O('https://www.seczambia.org.zm/') }),

  // ---- Zimbabwe ----
  T.company('ZW', { title: 'Companies and Other Business Entities Act', citation: '[Chapter 24:31] (2019)', regulator: 'Registrar of Companies', source: ag('zimbabwe') }),
  T.ngo('ZW', { title: 'Private Voluntary Organisations Act', citation: '[Chapter 17:05], as amended in 2025', regulator: 'Registrar of PVOs', source: icnl('zimbabwe'), extra: 'The 2025 amendments tightened registration and oversight.' }),
  T.data('ZW', { title: 'Cyber and Data Protection Act', citation: '[Chapter 12:07] (2021)', regulator: 'the Postal and Telecommunications Regulatory Authority (POTRAZ)', source: O('https://www.potraz.gov.zw/'), extra: 'Controllers must be licensed by the data protection authority.' }),
  T.corruption('ZW', { title: 'Anti-Corruption Commission Act', citation: '[Chapter 9:22]', regulator: 'the Zimbabwe Anti-Corruption Commission', source: O('https://www.zacc.co.zw/') }),
  T.aml('ZW', { title: 'Money Laundering and Proceeds of Crime Act', citation: '[Chapter 9:24]', regulator: 'the Financial Intelligence Unit', source: ag('zimbabwe') }),
  T.procurement('ZW', { title: 'Public Procurement and Disposal of Public Assets Act', citation: '[Chapter 22:23]', regulator: 'the Procurement Regulatory Authority of Zimbabwe', source: O('https://www.praz.org.zw/') }),
  T.govCode('ZW', { title: 'National Code on Corporate Governance Zimbabwe (ZIMCODE)', citation: 'ZIMCODE, 2014', regulator: 'Institute of Directors Zimbabwe; regulators by sector', source: ag('zimbabwe') }),
  T.labour('ZW', { title: 'Labour Act', citation: '[Chapter 28:01], as amended', regulator: 'Ministry of Public Service, Labour and Social Welfare', source: ag('zimbabwe') }),
  T.eia('ZW', { title: 'Environmental Management Act (EIA provisions)', citation: '[Chapter 20:27]', regulator: 'the Environmental Management Agency', source: O('https://www.ema.co.zw/') }),
  T.sustain('ZW', { title: 'Environmental Management Act', citation: '[Chapter 20:27]', regulator: 'Environmental Management Agency', source: O('https://www.ema.co.zw/') }),
  T.bank('ZW', { title: 'Banking Act', citation: '[Chapter 24:20]', regulator: 'the Reserve Bank of Zimbabwe', source: O('https://www.rbz.co.zw/') }),
  T.securities('ZW', { title: 'Securities and Exchange Act', citation: '[Chapter 24:25]', regulator: 'the Securities and Exchange Commission of Zimbabwe, with listing on the Zimbabwe Stock Exchange', source: O('https://www.seczim.co.zw/') }),
])
