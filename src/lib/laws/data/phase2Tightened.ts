// Corrections to the phase 2 register (46 countries), country by country, after checking each entry against a
// better source. A patch replaces a law firm's overview link with the official source (statute portal, regulator or
// gazette) where one was found, names amendments, records laws passed since phase 2 and confirms "no law" entries.
// Every patched entry keeps review 'pending' and records the date it was checked.
import type { LawEntry } from '../types.ts'

export const TIGHTENED = '2026-10-19'
type Src = { url: string; kind: 'official' | 'secondary' }
const O = (url: string): Src => ({ url, kind: 'official' })
const S = (url: string): Src => ({ url, kind: 'secondary' })
export type Patch = Partial<Pick<LawEntry, 'title' | 'citation' | 'regulator' | 'summary' | 'reformNote' | 'noLaw'>> & { source?: Src }

export const PHASE2_PATCHES: Record<string, Patch> = {
  // ---- Ghana ----
  'GH-company-1': { source: O('https://orc.gov.gh/') },
  'GH-integrity-2': { source: O('https://osp.gov.gh/') },
  'GH-labour-1': { citation: 'Act 651 (in force 31 March 2004)', source: S('https://ghalii.org/akn/gh/act/2003/651') },
  'GH-sustainability-1': {
    title: 'Environmental Protection Act, 2025', citation: 'Act 1124 (assented 6 January 2025), replacing the Environmental Protection Agency Act, 1994 (Act 490)',
    reformNote: 'Regulations under Act 1124 are being issued (for example the Effluent Regulations, 2025, L.I. 2506); check for new ones.',
  },
  'GH-eia-1': { reformNote: 'Act 1124 (2025) replaced Act 490; check whether new assessment regulations have replaced L.I. 1652.' },
  'GH-tax-1': {
    title: 'Income Tax Act, 2015 and Value Added Tax Act, 2025',
    citation: 'Act 896, as amended; VAT Act, 2025 (Act 1151), in force 1 January 2026, replacing Act 870', source: O('https://gra.gov.gh/'),
  },
  'GH-competition-1': {
    citation: 'Protection Against Unfair Competition Act, 2000 (Act 589) covers unfair trade practices only; a Competition Bill was still pending in early 2026',
    source: S('https://thebftonline.com/2026/02/03/finally-a-competition-anti-trust-law/'),
  },
  'GH-consumer-1': {
    citation: 'A Consumer Protection Bill was still not enacted in December 2025',
    source: S('https://citinewsroom.com/2025/12/pass-long-delayed-consumer-protection-and-competition-laws-cuts-intl-urges-parliament/'),
  },
  'GH-sanctions-1': {
    title: 'Anti-Terrorism Act, 2008 and Executive Instrument 2 on UN Security Council resolutions',
    citation: 'Act 762, as amended by Act 842 (2012) and Act 875 (2014); E.I. 2 (2013); Anti-Terrorism Regulations, 2012 (L.I. 2181)',
    source: O('https://www.fic.gov.gh/assets/publications/Anti-Terrorism-Act-2008-Act-762.pdf'),
  },
  'GH-forex-1': { source: O('https://www.bog.gov.gh/') },
  'GH-licensing-1': {
    title: 'Ghana Investment Promotion Authority Act, 2026', citation: 'Act 1173 (2026), repealing the Ghana Investment Promotion Centre Act, 2013 (Act 865)',
    regulator: 'the Ghana Investment Promotion Authority', source: O('https://gipa.gov.gh/'),
    reformNote: 'Act 1173 removed the blanket minimum capital requirements for most foreign-owned enterprises; check its regulations.',
  },

  // ---- Uganda ----
  'UG-company-2': { source: O('https://www.ngobureau.go.ug/') },
  'UG-labour-1': { source: O('https://mglsd.go.ug/') },
  'UG-tax-1': {
    citation: 'Income Tax Act (Cap. 338, 2023 revised edition), as amended; Value Added Tax Act, as amended by annual tax amendment acts',
    source: O('https://ura.go.ug/'),
  },
  'UG-competition-1': {
    citation: 'Competition Act, 2023 (assented February 2024, in force 19 April 2024); Competition Regulations, 2025 (S.I. No. 60 of 2025)',
    regulator: 'the Ministry of Trade, Industry and Cooperatives', source: O('https://www.mtic.go.ug/'),
    reformNote: 'The Act is run by the ministry; there is no independent competition authority yet.',
  },
  'UG-consumer-1': {
    title: 'No comprehensive consumer protection law in force', citation: 'A Consumer Protection Bill is still pending; consumer rules sit in sector laws and the Competition Act, 2023',
    regulator: null, noLaw: true,
    summary: 'No standalone consumer protection law is in force; a bill is pending. Consumer rules sit in sector legislation and the Competition Act. Treat consumers fairly to good-practice standards and watch for the new law.',
    source: S('https://eprcug.org/eprc-in-the-news/is-ugandas-consumer-really-protected/'),
  },
  'UG-sanctions-1': {
    title: 'Anti-Terrorism Act and Anti-Money Laundering Act (UN targeted financial sanctions)',
    citation: 'Anti-Terrorism Act, 2002, as amended; Anti-Money Laundering Act, 2013, as amended', source: O('https://www.fia.go.ug/'),
  },
  'UG-forex-1': { source: O('https://www.bou.or.ug/') },
  'UG-licensing-1': { source: O('https://ugandainvest.go.ug/') },

  // ---- Rwanda ----
  'RW-data-1': { source: O('https://dpo.gov.rw/') },
  'RW-integrity-1': { source: O('https://www.ombudsman.gov.rw/') },
  'RW-labour-1': { source: O('https://www.mifotra.gov.rw/') },
  'RW-tax-1': {
    title: 'Law establishing taxes on income and Law on value added tax',
    citation: 'Law No. 027/2022, as amended by Law No. 051/2023 and Law No. 014/2025; VAT Law No. 049/2023, as amended by Law No. 009/2025',
    source: O('https://www.rra.gov.rw/en/laws-policies-and-rulings'),
  },
  'RW-competition-1': {
    citation: 'Law No. 011/2026 of 26/02/2026, replacing Law No. 36/2012', source: O('https://rica.gov.rw/'),
    reformNote: 'The 2026 law is new; check its implementing regulations, including merger notification thresholds.',
  },
  'RW-consumer-1': { citation: 'Law No. 011/2026 of 26/02/2026, replacing Law No. 36/2012', source: O('https://rica.gov.rw/') },
  'RW-sanctions-1': {
    title: 'Law on money laundering, terrorist financing and proliferation financing (UN targeted financial sanctions)',
    citation: 'Law No. 028/2023 of 19/05/2023', source: O('https://www.fic.gov.rw/'),
  },
  'RW-forex-1': { source: O('https://www.bnr.rw/') },
  'RW-licensing-1': { citation: 'Law No. 006/2021 on investment promotion and facilitation', source: O('https://rdb.rw/') },

  // ---- Zambia ----
  'ZM-company-2': { citation: 'Act No. 16 of 2009', reformNote: 'The Non-Governmental Organisations Bill No. 6 of 2025 would repeal and replace the 2009 Act; check its status.' },
  'ZM-integrity-1': { source: O('https://acc.gov.zm/') },
  'ZM-labour-1': { source: O('https://www.mlss.gov.zm/') },
  'ZM-tax-1': { citation: 'Income Tax Act (Cap. 323) and Value Added Tax Act, as amended by annual finance acts', source: O('https://www.zra.org.zm/') },
  'ZM-competition-1': { source: O('https://www.ccpc.org.zm/') },
  'ZM-consumer-1': { source: O('https://www.ccpc.org.zm/') },
  'ZM-sanctions-1': {
    title: 'Anti-Terrorism and Non-Proliferation Act (UN targeted financial sanctions)',
    citation: 'Anti-Terrorism and Non-Proliferation Act No. 6 of 2018, as amended in 2023 and by Act No. 30 of 2024; Financial Intelligence Centre Act No. 46 of 2010, as amended',
    source: O('https://www.fic.gov.zm/'),
  },
  'ZM-forex-1': { source: O('https://www.boz.zm/') },
  'ZM-licensing-1': {
    citation: 'Act No. 17 of 2022, repealing the Zambia Development Agency Act, 2006', source: O('https://www.zda.org.zm/'),
    reformNote: 'A Zambia Development Agency (Amendment) Bill, 2026 would change the Board; check its status.',
  },

  // ---- Tanzania ----
  'TZ-data-1': { source: O('https://pdpc.go.tz/') },
  'TZ-integrity-1': { source: O('https://www.pccb.go.tz/') },
  'TZ-labour-1': { source: O('https://www.kazi.go.tz/') },
  'TZ-tax-1': { citation: 'Income Tax Act (Cap. 332) and Value Added Tax Act (Cap. 148), as amended by annual finance acts', source: O('https://www.tra.go.tz/') },
  'TZ-competition-1': {
    citation: 'Fair Competition Act (Cap. 285, R.E. 2023), as amended by Act No. 13 of 2024; Fair Competition (Abuse of Dominant Position) Regulations, 2026',
    source: O('https://fcc.go.tz/'), reformNote: 'The 2024 amendments raised the dominance threshold to 40% and added joint dominance.',
  },
  'TZ-consumer-1': {
    citation: 'Fair Competition Act (Cap. 285, R.E. 2023), as amended by Act No. 13 of 2024 (price display and consumer complaints to the Commission)',
    source: O('https://fcc.go.tz/'),
  },
  'TZ-sanctions-1': {
    title: 'Anti-Money Laundering Act and Prevention of Terrorism Act (UN targeted financial sanctions)',
    citation: 'Anti-Money Laundering Act (Cap. 423) and Prevention of Terrorism Act (Cap. 19), with regulations giving effect to UN Security Council resolutions',
    source: O('https://www.fiu.go.tz/'),
  },
  'TZ-forex-1': { citation: 'Foreign Exchange Act, 1992 (Cap. 271), as amended', source: O('https://www.bot.go.tz/') },
  'TZ-licensing-1': {
    title: 'Investment and Special Economic Zones Act, 2025', citation: 'Act No. 6 of 2025, repealing the Tanzania Investment Act, 2022 and the export processing and special economic zones laws',
    regulator: 'the Tanzania Investment and Special Economic Zones Authority (TISEZA)', source: O('https://www.tiseza.go.tz/'),
    reformNote: 'TISEZA merged the Tanzania Investment Centre and the Export Processing Zones Authority in 2025; check transitional rules for existing incentive certificates.',
  },

  // ---- Botswana ----
  'BW-data-1': { citation: 'Act No. 18 of 2024 (in effect from January 2025), replacing the 2018 Act, which never came into force' },
  'BW-integrity-1': { source: O('https://www.gov.bw/ministries/directorate-corruption-and-economic-crime') },
  'BW-procurement-1': { citation: 'Act No. 24 of 2021', source: S('https://botswanalaws.com/bulletin/principal-legislation/bulletin-2021/act-24-of-2021---public-procurement-act') },
  'BW-tax-1': {
    citation: 'Income Tax Act (Cap. 52:01) and Value Added Tax Act (Cap. 50:03), as amended (including VAT Amendment Act No. 16 of 2025)', source: O('https://www.burs.org.bw/'),
    reformNote: 'A Value Added Tax Bill, 2025 (Bill No. 39) would repeal and re-enact the VAT Act, including VAT on digital services; check its status.',
  },
  'BW-competition-1': { source: O('https://www.cca.co.bw/') },
  'BW-consumer-1': { source: O('https://www.cca.co.bw/') },
  'BW-sanctions-1': {
    title: 'Counter-Terrorism Act and Financial Intelligence Act (UN targeted financial sanctions)',
    citation: 'Counter-Terrorism Act, as amended; Financial Intelligence Act, 2022', source: O('https://fia.org.bw/'),
  },
  'BW-forex-1': { source: O('https://www.bankofbotswana.bw/') },
  'BW-licensing-1': { source: O('https://www.bitc.co.bw/') },

  // ---- Namibia ----
  'NA-data-1': { citation: 'A Data Protection Bill (drafted 2021, revised) was still being finalised in July 2026; only the constitutional right to privacy (Article 13) applies' },
  'NA-governance-1': { source: O('https://www.nsx.com.na/') },
  'NA-sustainability-1': { source: O('https://www.meft.gov.na/') },
  'NA-eia-1': { source: O('https://www.meft.gov.na/') },
  'NA-tax-1': { citation: 'Income Tax Act 24 of 1981 and Value-Added Tax Act 10 of 2000, as amended', source: O('https://www.namra.org.na/') },
  'NA-competition-1': { source: O('https://www.nacc.com.na/') },
  'NA-sanctions-1': {
    title: 'Prevention and Combating of Terrorist and Proliferation Activities Act (UN targeted financial sanctions)',
    citation: 'Act 4 of 2014, as amended by Act 8 of 2023 (in force 25 July 2023), and its regulations; Financial Intelligence Act 13 of 2012, as amended',
    source: O('https://www.fic.na/'),
  },
  'NA-forex-1': { source: O('https://www.bon.com.na/') },
  'NA-licensing-1': {
    title: 'Foreign Investments Act', citation: 'Act 27 of 1990, as amended; the Namibia Investment Promotion Act 9 of 2016 was never brought into force',
    regulator: 'the Namibia Investment Promotion and Development Board (Office of the President)', source: O('https://nipdb.com/'),
    reformNote: 'An Investment Promotion and Facilitation Bill is expected to replace both Acts; check its status.',
  },

  // ---- Zimbabwe ----
  // Veritas publishes Zimbabwe's Acts and bills; it is independent of government, so it stays a secondary source.
  'ZW-company-1': { source: S('https://www.veritaszim.net/') },
  'ZW-integrity-2': { source: O('https://www.fiu.co.zw/') },
  'ZW-labour-1': { source: O('https://www.mpslsw.gov.zw/') },
  'ZW-tax-1': { citation: 'Income Tax Act [Chapter 23:06] and Value Added Tax Act [Chapter 23:12], as amended by annual finance acts', source: O('https://www.zimra.co.zw/') },
  'ZW-competition-1': {
    source: O('https://www.competition.co.zw/'),
    reformNote: 'A Competition Amendment Bill, 2025 would widen the Commission\'s investigation and enforcement powers; check its status.',
  },
  'ZW-consumer-1': { source: O('https://www.cpc.org.zw/') },
  'ZW-sanctions-1': {
    title: 'Suppression of Foreign and International Terrorism Act and Money Laundering and Proceeds of Crime Act (UN targeted financial sanctions)',
    citation: 'Suppression of Foreign and International Terrorism Act [Chapter 11:21]; Money Laundering and Proceeds of Crime Act [Chapter 9:24], as amended, with regulations giving effect to UN Security Council resolutions',
    source: O('https://www.fiu.co.zw/'),
  },
  'ZW-forex-1': { source: O('https://www.rbz.co.zw/') },
  // ---- Algeria ----
  // The Journal officiel (JORADP) is the official source of Algerian legislation; several regulators' sites are unreachable from abroad.
  'DZ-company-1': { source: O('https://www.joradp.dz/') },
  'DZ-data-1': { citation: 'Law No. 18-07 of 10 June 2018, as amended by Law No. 25-11 of 24 July 2025', source: O('https://anpdp.dz/'),
    reformNote: 'Law No. 25-11 (2025) revised core definitions and principles; check its implementing texts on data protection officers and impact assessments.' },
  'DZ-integrity-1': { source: O('https://www.joradp.dz/') },
  'DZ-integrity-2': { source: O('https://www.joradp.dz/') },
  'DZ-procurement-1': { source: O('https://www.joradp.dz/') },
  'DZ-labour-1': { source: O('https://www.joradp.dz/') },
  'DZ-tax-1': { source: O('https://www.mfdgi.gov.dz/') },
  'DZ-competition-1': { source: O('https://www.conseil-concurrence.dz/') },
  'DZ-consumer-1': { source: O('https://www.joradp.dz/') },
  'DZ-sanctions-1': { citation: 'Law No. 05-01 of 2005 on money laundering and terrorist financing, as amended in 2023, with implementing decrees on freezing', source: O('https://www.joradp.dz/') },
  'DZ-forex-1': { source: O('https://www.bank-of-algeria.dz/') },
  'DZ-licensing-1': { source: O('https://www.joradp.dz/') },

  // ---- Libya ----
  'LY-company-1': { citation: 'Law No. 23 of 2010, as amended by Law No. 7 of 2023', source: S('https://lawsociety.ly/en/legislation/law-no-23-of-2010-regarding-commercial-activity/10/') },
  'LY-integrity-2': { source: O('https://cbl.gov.ly/') },
  'LY-competition-1': {
    title: 'Competition provisions of the Law on Commercial Activity', noLaw: false,
    citation: 'Law No. 23 of 2010, Title 11 (articles 1282-1307), as amended by Law No. 7 of 2023; Executive Regulations, Resolution No. 6 of 2024 (in force 14 April 2024)',
    regulator: 'the Competition Council', source: S('https://alp.unescwa.org/legislations/resolution-no-62024-regarding-issuance-executive-regulations-regarding-provisions'),
    summary: 'Prohibits anti-competitive agreements and abuse of a dominant position (presumed above a 30% market share), with a Competition Council created in 2023 that can stop infringing practices. Implementing regulations took effect in April 2024.',
  },
  'LY-consumer-1': {
    title: 'Consumer protection provisions of the Law on Commercial Activity', noLaw: false,
    citation: 'Law No. 23 of 2010, Title 11, as amended by Law No. 7 of 2023; Executive Regulations, Resolution No. 6 of 2024',
    regulator: 'the Competition Council and the Ministry of Economy', source: S('https://alp.unescwa.org/legislations/resolution-no-62024-regarding-issuance-executive-regulations-regarding-provisions'),
    summary: 'Sets consumer rights to information, fair pricing and safe goods and services within the commercial law, with implementing regulations in force since April 2024.',
  },
  'LY-sanctions-1': { source: O('https://cbl.gov.ly/') },
  'LY-forex-1': { source: O('https://cbl.gov.ly/') },

  // ---- Mauritania ----
  'MR-data-1': {
    citation: 'Law No. 2017-020 of 22 July 2017; the Personal Data Protection Authority (APD) was constituted in 2022 (Decree No. 2022-013), but whether the Law is fully in force is unclear',
    reformNote: 'With the authority now constituted, treat the Law as likely to be enforced and confirm its status before relying on this entry.',
  },
  'MR-procurement-1': { source: O('https://www.armp.mr/') },
  'MR-forex-1': { source: O('https://www.bcm.mr/') },

  // ---- Tunisia ----
  'TN-integrity-2': { source: O('https://www.ctaf.gov.tn/') },
  'TN-labour-1': {
    citation: 'Law No. 66-27 of 1966, as amended, including Law No. 2025-9 of 21 May 2025 on employment contracts and subcontracting',
    reformNote: 'Law No. 2025-9 makes open-ended contracts the rule, limits fixed-term contracts to set cases, bans labour subcontracting for core activities and caps probation; check its effect on existing contracts.',
  },
  'TN-tax-1': { source: O('https://www.finances.gov.tn/') },
  'TN-sanctions-1': { source: O('https://www.ctaf.gov.tn/') },
  'TN-forex-1': { source: O('https://www.bct.gov.tn/') },
  'TN-licensing-1': { source: O('https://tia.gov.tn/') },

  // ---- Benin ----
  // The Secrétariat Général du Gouvernement (sgg.gouv.bj) publishes Benin's laws and decrees.
  'BJ-integrity-2': { source: O('https://sgg.gouv.bj/') },
  'BJ-procurement-1': { source: O('https://armp.bj/') },
  'BJ-labour-1': { source: O('https://sgg.gouv.bj/') },
  'BJ-consumer-1': { source: O('https://sgg.gouv.bj/') },
  'BJ-sanctions-1': {
    citation: 'Law No. 2018-17 on money laundering and terrorist financing, as amended by Law No. 2020-25; a new uniform law covering proliferation financing (Law No. 2024-01) was adopted in January 2024',
    source: O('https://sgg.gouv.bj/'), reformNote: 'Confirm that Law No. 2024-01 has been promulgated and has replaced Law No. 2018-17.',
  },
  'BJ-licensing-1': { citation: 'Law No. 2020-02 of 20 March 2020 on the Investment Code, replacing Law No. 90-002; Decree No. 2021-005', source: O('https://investbenin.bj/') },

  // ---- Burkina Faso ----
  'BF-consumer-1': {
    title: 'Consumer provisions of the law on competition', noLaw: false,
    citation: 'Law No. 016-2017/AN on the organisation of competition (consumer information, invoicing, guarantees and misleading advertising)',
    regulator: 'the Commission Nationale de la Concurrence et de la Consommation (CNCC)', source: O('https://www.an.bf/'),
    summary: 'Protects consumers within the competition law: a right to information on goods and services, invoices, guarantees and after-sales service, and a ban on misleading advertising, overseen by the national competition and consumer commission.',
  },
  'BF-sanctions-1': {
    citation: 'Law No. 016-2016/AN of 3 May 2016 (WAEMU uniform law on money laundering and terrorist financing); a law extending it to proliferation financing was adopted in 2024',
    source: O('https://www.centif.bf/'),
  },

  // ---- Côte d'Ivoire ----
  'CI-procurement-1': {
    regulator: "the Autorité de Régulation de la Commande Publique (ARCOP), formerly the ANRMP", source: O('https://arcop.ci/'),
    reformNote: 'An ordinance adopted in January 2025 renamed the regulator ARCOP and extended it to public-private partnerships; check for a revised procurement code.',
  },
  'CI-eia-1': { citation: 'Law No. 2023-900 of 23 November 2023 on the Environment Code, which replaced Law No. 96-766; Decree No. 96-894 on impact studies (check for a replacement decree)' },
  'CI-sustainability-1': { title: 'Environment Code', citation: 'Law No. 2023-900 of 23 November 2023, replacing Law No. 96-766' },
  'CI-tax-1': { source: O('https://www.dgi.gouv.ci/') },
  'CI-sanctions-1': {
    citation: 'Ordinance No. 2023-875 of 23 November 2023 on money laundering, terrorist financing and proliferation financing, replacing Law No. 2016-992',
    source: O('https://www.centif.ci/'),
  },
  'CI-licensing-1': { source: O('https://cepici.ci/') },

  // ---- The Gambia ----
  'GM-data-1': { citation: 'Personal Data Protection and Privacy Act, 2025 (passed 29 September 2025, assented 7 November 2025)' },
  'GM-labour-1': {
    title: 'Labour Act, 2023', citation: 'Labour Act 2023 (184 sections, in force)', source: O('https://assembly.gm/documents/318'),
    reformNote: 'A Labour (Amendment) Bill, 2026 on private recruitment agencies was published in July 2026; check its status.',
  },
  'GM-tax-1': { source: O('https://www.gra.gm/') },
  'GM-competition-1': { source: O('https://gcc.gm/') },
  'GM-consumer-1': { source: O('https://gcc.gm/') },
  'GM-forex-1': { source: O('https://www.cbg.gm/') },
  'GM-licensing-1': { source: O('https://www.giepa.gm/') },

  // ---- Guinea ----
  'GN-competition-1': {
    title: 'Competition law not yet in operation',
    citation: 'A competition law created a National Competition Committee, which is not yet functional; ECOWAS rules apply to cross-border practices',
    source: S('https://unctad.org/node/35389'),
  },
  'GN-consumer-1': {
    title: 'Law on consumer protection, control of goods and services and fraud repression', noLaw: false,
    citation: 'Law No. L/94/003/CTRN', regulator: 'the National Council for Consumer Protection and the Ministry of Commerce',
    summary: 'Sets consumer rights and the duties of economic operators, with controls on the quality of goods and services and penalties for fraud. Its consumer council still needs implementing rules.',
    source: S('https://leap.unep.org/en/countries/gn/national-legislation/loi-no-l94003ctrn-relative-la-protection-des-consommateurs-au'),
  },
  'GN-forex-1': { source: O('https://www.bcrg-guinee.org/') },

  // ---- Liberia ----
  'LR-integrity-1': { source: O('https://www.lacc.gov.lr/') },
  'LR-tax-1': { source: O('https://revenue.lra.gov.lr/') },
  'LR-competition-1': {
    title: 'Competition Law of Liberia', noLaw: false, citation: 'Act to Enact the Competition Law of Liberia (2016)',
    regulator: 'the Ministry of Commerce and Industry (no competition authority yet)',
    summary: 'Prohibits anti-competitive agreements and abuse of market power to support an efficient free market. No dedicated authority has been set up, and the government plans a combined competition and consumer protection law aligned with ECOWAS rules.',
    source: S('https://liblaw.org/document-category/legislative-acts-by-year/2016/'),
  },
  'LR-sanctions-1': { source: O('https://www.cbl.org.lr/') },
  'LR-forex-1': { source: O('https://www.cbl.org.lr/') },
  'LR-licensing-1': { source: O('https://nic.gov.lr/') },

  // ---- Mali ----
  'ML-data-1': { source: O('https://www.apdp.ml/') },
  'ML-procurement-1': { source: O('https://www.armds.ml/') },
  'ML-tax-1': { source: O('https://www.dgi.gouv.ml/') },
  'ML-consumer-1': {
    title: 'Law on consumer protection', noLaw: false, citation: 'Law No. 2015-036 of 16 July 2015; Decree No. 2016-0482/P-RM; complemented by the 2018 law on fraudulent commercial practices',
    regulator: 'the Ministry of Trade', source: S('https://www.labase-lextenso.fr/l-essentiel-droits-africains-des-affaires/2018-n10/mali-la-loi-du-12-juin-2018-relative-aux-pratiques-commerciales-frauduleuses-DAA111s5'),
    summary: 'Sets consumer rights to information, fair terms, safe goods and services and redress, with rules on advertising and consumer credit; a 2018 law adds penalties for fraudulent commercial practices.',
  },
  'ML-licensing-1': { source: O('https://apimali.gov.ml/') },

  // ---- Niger ----
  'NE-consumer-1': { citation: 'Niger has adopted specific consumer protection rules, but their text and number were not confirmed; consumer rules otherwise sit in commercial and sector legislation' },

  // ---- Sierra Leone ----
  'SL-data-1': {
    citation: 'A Data Protection and Right to Access Information Bill, 2025 completed national validation in November 2025, and a National Data Protection Policy was approved in April 2026; no law is yet in force',
    source: O('https://moice.gov.sl/'),
  },
  'SL-competition-1': { citation: 'A draft Competition Bill has not been enacted; ECOWAS rules apply to cross-border practices' },
  'SL-tax-1': { source: O('https://www.nra.gov.sl/') },
  'SL-licensing-1': { source: O('https://www.sliepa.gov.sl/') },

  // ---- Togo ----
  'TG-data-1': { source: O('https://ipdcp.tg/') },
  'TG-procurement-1': { source: O('https://arcop.tg/') },
  'TG-tax-1': { source: O('https://www.otr.tg/') },
  'TG-sanctions-1': { source: O('https://www.centif.tg/') },
  'TG-licensing-1': { source: O('https://apizf.org/') },

  // ---- Guinea-Bissau ----
  'GW-data-1': { citation: 'No data protection law has been enacted; Law No. 5/2010 on the information society has limited provisions, and the ECOWAS Supplementary Act on personal data applies regionally' },
  'GW-procurement-1': { source: O('https://arcp.gw/') },
  'GW-licensing-1': {
    citation: 'Investment Code, Law of 6 July 2011 (numbered 3/2011 by UNCTAD and 13/2011 in the Ministry of Finance copy); mining, oil, forestry and free zones have separate rules',
    source: O('https://alfandegas.mef.gw/wp-content/uploads/2025/03/Codigo-do-Investimento-da-Guine-Bissau.pdf'),
  },

  // ---- Burundi ----
  'BI-data-1': {
    citation: 'The National Assembly adopted a personal data protection law on 15 January 2026 (with an independent supervisory authority); promulgation not yet confirmed. Confidentiality rules also appear in the 2022 cybercrime law',
    source: S('https://www.osiris.sn/burundi-le-parlement-adopte-une-loi-cle-sur-la-protection-des-donnees.html'),
    reformNote: 'Once promulgated, the new law will replace this "no law" entry; check the Official Bulletin.',
  },
  'BI-tax-1': { source: O('https://www.obr.bi/') },
  'BI-forex-1': { source: O('https://www.brb.bi/') },

  // ---- Cameroon ----
  'CM-data-1': {
    citation: 'Law No. 2024/017 of 23 December 2024 (applicable from 23 June 2026 after an 18-month transition)', regulator: 'the Autorité de Protection des Données Personnelles (APDP)',
    source: S('https://cio-mag.com/protection-des-donnees-au-cameroun-la-course-contre-la-montre-avant-juin-2026/'),
    reformNote: 'Transfers outside Cameroon need equivalent protection and the authority\'s prior authorisation; check the implementing texts now that the Law applies.',
  },
  'CM-procurement-1': { source: O('https://www.armp.cm/') },
  'CM-tax-1': { source: O('https://www.impots.cm/') },
  'CM-sanctions-1': { citation: 'CEMAC Regulation No. 01/CEMAC/UMAC/CM of 2016, as revised by Regulation No. 02/24/CEMAC/UMAC/CM of 20 December 2024', source: O('https://anif.cm/') },
  'CM-licensing-1': { source: O('https://www.investiraucameroun.com/') },

  // ---- Central African Republic ----
  'CF-sanctions-1': { citation: 'CEMAC Regulation No. 01/CEMAC/UMAC/CM of 2016, as revised by Regulation No. 02/24/CEMAC/UMAC/CM of 20 December 2024', source: O('https://www.beac.int/') },
  'CF-licensing-1': { citation: 'Investment Charter, Law of 2018, replacing Law No. 01-010 of 2001', source: S('https://investmentpolicy.unctad.org/investment-laws/laws/524/central-african-republic-central-african-republic-investment-charter-2018') },

  // ---- Chad ----
  'TD-sanctions-1': { citation: 'CEMAC Regulation No. 01/CEMAC/UMAC/CM of 2016, as revised by Regulation No. 02/24/CEMAC/UMAC/CM of 20 December 2024', source: O('https://www.beac.int/') },
  'TD-licensing-1': { citation: 'Law No. 006/PR/2008 of 3 January 2008 on the Investment Charter', source: O('https://anie-tchad.com/') },

  // ---- Republic of the Congo ----
  'CG-sanctions-1': { citation: 'CEMAC Regulation No. 01/CEMAC/UMAC/CM of 2016, as revised by Regulation No. 02/24/CEMAC/UMAC/CM of 20 December 2024', source: O('https://www.beac.int/') },
  'CG-licensing-1': { citation: 'Law No. 6-2003 of 18 January 2003 on the Investment Charter', source: O('https://www.sgg.cg/') },

  // ---- Democratic Republic of the Congo ----
  'CD-tax-1': { source: O('https://dgi.gouv.cd/') },
  'CD-competition-1': { citation: 'Law No. 18/020 of 9 July 2018 on freedom of prices and competition' },
  'CD-forex-1': { source: O('https://www.bcc.cd/') },
  'CD-licensing-1': { source: O('https://anapi.cd/') },

  // ---- Equatorial Guinea ----
  'GQ-data-1': { citation: 'Law No. 1/2016 of 22 July 2016', reformNote: 'The data protection authority the Law creates is not yet operational, so enforcement is limited; follow the Law\'s consent and security rules anyway.' },
  'GQ-sanctions-1': { citation: 'CEMAC Regulation No. 01/CEMAC/UMAC/CM of 2016, as revised by Regulation No. 02/24/CEMAC/UMAC/CM of 20 December 2024', source: O('https://www.beac.int/') },

  // ---- Gabon ----
  'GA-tax-1': { source: O('https://dgi.ga/') },
  'GA-consumer-1': {
    citation: 'No national consumer law: CEMAC consumer rules apply, and a bill transposing CEMAC Directive No. 02/19-UEAC-639-CM-33 of 8 April 2019 is in preparation',
    reformNote: 'A ministry for consumer affairs was created in January 2023; watch for the transposing law.',
  },
  'GA-sanctions-1': { citation: 'CEMAC Regulation No. 01/CEMAC/UMAC/CM of 2016, as revised by Regulation No. 02/24/CEMAC/UMAC/CM of 20 December 2024', source: O('https://www.beac.int/') },

  // ---- São Tomé and Príncipe ----
  'ST-forex-1': { source: O('https://www.bcstp.st/') },
  'ST-integrity-1': { source: O('https://www.bcstp.st/') },

  // ---- Ethiopia ----
  'ET-integrity-2': { citation: 'Proclamation No. 780/2013, as amended, including by Amendment Proclamation No. 1387/2025' },
  'ET-tax-1': {
    citation: 'Federal Income Tax Proclamation No. 979/2016, as amended by Proclamation No. 1395/2025 (from July 2025); VAT Proclamation of 2024',
    source: O('https://www.mor.gov.et/'),
    reformNote: 'The 2025 amendment added an alternative minimum tax (2.5% of turnover) and lowered the permanent establishment threshold to 91 days.',
  },
  'ET-sanctions-1': { citation: 'Proclamation No. 780/2013 on money laundering and terrorist financing, as amended (including No. 1387/2025), with regulations giving effect to UN Security Council resolutions' },
  'ET-forex-1': { source: O('https://nbe.gov.et/') },
  'ET-licensing-1': { source: O('https://investethiopia.gov.et/') },

  // ---- Madagascar ----
  'MG-integrity-2': {
    citation: 'Law No. 2023-026 on money laundering and terrorist financing',
    source: O('https://www.assemblee-nationale.mg/wp-content/uploads/2024/02/Loi-n%C2%B0-2023-026-Blanchiment-de-capitaux.pdf'),
  },
  'MG-tax-1': { source: O('https://www.impots.mg/') },
  'MG-consumer-1': {
    title: 'Law on guarantees and consumer protection', noLaw: false, citation: 'Law No. 2015-014',
    regulator: 'the Ministry of Commerce', source: S('https://leap.unep.org/en/countries/mg/national-legislation/loi-ndeg-2015-014-sur-les-garanties-et-la-protection-des'),
    summary: 'Sets consumer rights to information, legal and commercial guarantees, fair contract terms and safe products, with controls and penalties enforced by the trade ministry.',
  },
  'MG-sanctions-1': { citation: 'Law No. 2023-026 on money laundering and terrorist financing, as implemented by national regulations' },
  'MG-forex-1': { source: O('https://www.banky-foibe.mg/') },
  'MG-licensing-1': { source: O('https://edbm.mg/') },

  // ---- Djibouti ----
  'DJ-data-1': {
    title: 'Digital Code (Book I: personal data protection)', noLaw: false,
    citation: 'Digital Code adopted by the National Assembly on 30 June 2025 (about 800 articles; Book I on personal data)',
    regulator: 'the Commission Nationale de Protection des Données Personnelles (CNDP)',
    summary: 'Requires a lawful basis and transparency for processing personal data, data protection by design, data subject rights, breach notification within 72 hours and a data protection officer, with heavy penalties, overseen by the national data protection commission.',
    source: S('https://www.jonesday.com/en/insights/2025/07/national-assembly-of-the-republic-of-djibouti-approves-digital-code'),
    reformNote: 'Reports differ on whether the CNDP is operational yet; confirm before relying on registration or authorisation duties.',
  },

  // ---- Comoros ----
  'KM-forex-1': { source: O('https://banque-comores.km/') },
  'KM-integrity-1': { source: O('https://banque-comores.km/') },

  // ---- Seychelles ----
  'SC-tax-1': { source: O('https://src.gov.sc/') },
  'SC-forex-1': { source: O('https://www.cbs.sc/') },
  'SC-licensing-1': { citation: 'Seychelles Investment Act, 2010 (Act 31 of 2010), as amended by Act 15 of 2021; investment regulations of 2022', source: O('https://www.gazette.sc/') },

  // ---- Somalia ----
  'SO-integrity-1': { source: O('https://frc.gov.so/') },
  'SO-labour-1': {
    title: 'Labour Law', citation: 'Law No. 36 of 2024, replacing the Labour Code (Law No. 65 of 1972); launched in 2026',
    source: S('https://allafrica.com/stories/202602090088.html'),
  },
  'SO-tax-1': { source: O('https://mof.gov.so/') },
  'SO-sanctions-1': { source: O('https://frc.gov.so/') },
  'SO-forex-1': { source: O('https://centralbank.gov.so/') },
  'SO-licensing-1': {
    title: 'Investment Law', citation: 'Investment Law passed by the Senate on 29 November 2025, establishing the Somali Investment Authority (SOMINVEST) and a National Investment Council',
    regulator: 'the Somali Investment Authority (SOMINVEST)', source: S('https://dawan.africa/news/somalias-upper-house-approves-bill-aimed-at-attracting-investments'),
    reformNote: 'Check the Law\'s promulgation and its regulations; a model bilateral investment treaty framework is being drafted.',
  },

  // ---- South Sudan ----
  'SS-forex-1': { source: O('https://boss.gov.ss/') },

  // ---- Sudan ----
  'SD-forex-1': { source: O('https://cbos.gov.sd/') },

  // ---- Angola ----
  'AO-tax-1': { source: O('https://agt.minfin.gov.ao/') },

  // ---- Eswatini ----
  'SZ-tax-1': { source: O('https://www.ers.org.sz/') },
  'SZ-competition-1': { citation: 'Competition Act, 2007 (in force 1 April 2008)', source: O('https://www.compco.co.sz/'),
    reformNote: 'A COMESA-supported review of the Competition Act, 2007 and the Fair Trading Act, 2001 began in 2024; check for amendments.' },
  'SZ-consumer-1': { citation: 'No standalone consumer protection act; the Fair Trading Act, 2001 and the consumer-welfare provisions of the Competition Act, 2007 apply (both under review)', source: O('https://www.compco.co.sz/') },
  'SZ-forex-1': { source: O('https://www.centralbank.org.sz/') },

  // ---- Lesotho ----
  'LS-competition-1': {
    citation: 'A Competition Act, 2022 was published on 9 September 2022 but its commencement had not been confirmed; general commercial law applies meanwhile',
    source: S('https://www.afriwise.com/blog/lesothos-competition-act-2022-on-the-verge-of-implementation'),
    reformNote: 'Watch for the commencement notice of the Competition Act, 2022.',
  },
  'LS-licensing-1': { source: O('https://lndc.org.ls/') },

  // ---- Mozambique ----
  'MZ-data-1': {
    citation: 'No general data protection law yet: a draft law has been consulted on (Council of Ministers approval reported in March 2026); the Constitution (Article 71), Law No. 3/2017 and the 2026 Cybersecurity (Law No. 13/2026) and Cybercrime (Law No. 14/2026) laws apply',
    source: S('https://aimnews.org/2026/08/25/intic-alerta-para-desafios-na-proteccao-de-dados-pessoais-em-mocambique/'),
  },
  'MZ-tax-1': { source: O('https://www.at.gov.mz/') },
  'MZ-forex-1': { source: O('https://www.bancomoc.mz/') },

  // ---- Malawi ----
  'MW-company-2': { source: O('https://www.ngora.mw/') },
  'MW-integrity-2': { citation: 'Financial Crimes Act No. 14 of 2017 (in force 17 February 2017)', source: O('https://www.fia.gov.mw/publications/Financial%20Crimes%20Act%20No%2014%20of%202017.pdf') },
  'MW-labour-1': { source: O('https://www.labour.gov.mw/') },
  'MW-eia-1': { source: O('https://www.mepa.mw/') },
  'MW-sustainability-1': { source: O('https://www.mepa.mw/') },
  'MW-tax-1': { source: O('https://www.mra.mw/') },
  'MW-competition-1': { source: O('https://www.cftc.mw/') },
  'MW-consumer-1': { source: O('https://www.cftc.mw/') },
  'MW-sanctions-1': {
    title: 'Financial Crimes Act and Suppression of Terrorist Financing and Proliferation Regulations (UN targeted financial sanctions)',
    citation: 'Financial Crimes Act No. 14 of 2017; Financial Crimes (Suppression of Terrorist Financing and Proliferation) Regulations, 2017',
    source: O('https://www.fia.gov.mw/publications/Financial%20Crimes%20Act%20No%2014%20of%202017.pdf'),
  },
  'MW-forex-1': { source: O('https://www.rbm.mw/') },
  'MW-licensing-1': { source: O('https://mitc.mw/') },

  'ZW-licensing-1': { citation: 'Zimbabwe Investment and Development Agency Act [Chapter 14:37], Act No. 10 of 2019 (gazetted 7 February 2020)', source: O('https://zidainvest.com/') },
}

/** Applies the patches; every patched entry records the date it was checked. */
export function applyPatches(entries: LawEntry[], patches: Record<string, Patch> = PHASE2_PATCHES): LawEntry[] {
  return entries.map((e) => {
    const p = patches[e.id]
    if (!p) return e
    const { source, ...rest } = p
    return { ...e, ...rest, source: { ...(source ?? e.source), checked: TIGHTENED } }
  })
}
