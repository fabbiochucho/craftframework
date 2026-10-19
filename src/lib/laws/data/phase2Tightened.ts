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
  'ZM-tax-1': { citation: 'Income Tax Act (Cap. 323) and Value Added Tax Act (Cap. 331), as amended by annual finance acts', source: O('https://www.zra.org.zm/') },
  'ZM-competition-1': { source: O('https://www.ccpc.org.zm/') },
  'ZM-consumer-1': { source: O('https://www.ccpc.org.zm/') },
  'ZM-sanctions-1': {
    title: 'Anti-Terrorism and Non-Proliferation Act (UN targeted financial sanctions)',
    citation: 'Anti-Terrorism and Non-Proliferation Act No. 6 of 2018; Financial Intelligence Centre Act No. 46 of 2010, as amended',
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
  'BW-tax-1': { citation: 'Income Tax Act (Cap. 52:01) and Value Added Tax Act (Cap. 50:03), as amended', source: O('https://www.burs.org.bw/') },
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
