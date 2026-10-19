// Continental (African Union) instruments that apply across the countries that ratify them: the AfCFTA Agreement
// and the African Medicines Agency Treaty. Each country's ratification status is recorded from a dated source and
// shown against the organisation's own African countries in its jurisdiction report. Pending review.
import type { LawEntry } from '../types.ts'
import { finalize } from './helpers.ts'

const CHECKED = '2026-10-19'

export const CONTINENTAL_LAWS: LawEntry[] = finalize([
  {
    id: '', jurisdiction: 'AU', area: 'licensing', review: 'pending',
    title: 'Agreement Establishing the African Continental Free Trade Area (AfCFTA)',
    citation: 'Adopted in Kigali, 21 March 2018; in force 30 May 2019; Protocols on Trade in Goods, Trade in Services and Dispute Settlement',
    regulator: 'the AfCFTA Secretariat (Accra), with each State Party\'s customs and trade authorities',
    summary: 'Creates a single African market: tariffs phased out on 90% of tariff lines under agreed rules of origin, services opened in priority sectors, and a dispute settlement mechanism. Preferences apply only between countries that have ratified and gazetted their tariff schedules.',
    reformNote: 'Adopted but not yet in force, each needing 22 ratifications: the Protocols on Competition Policy, Investment and Intellectual Property Rights (February 2023), Digital Trade (February 2024, annexes February 2025) and Women and Youth in Trade (February 2024). The AU Assembly asked members to ratify them by the end of 2026.',
    source: { url: 'https://au-afcfta.org/', kind: 'official', checked: CHECKED },
  },
  {
    id: '', jurisdiction: 'AU', area: 'licensing', review: 'pending',
    title: 'Treaty for the Establishment of the African Medicines Agency (AMA)',
    citation: 'Adopted in Addis Ababa, 11 February 2019; in force 5 November 2021',
    regulator: 'the African Medicines Agency (Kigali), working with national medicines regulators',
    summary: 'Establishes the African Medicines Agency to coordinate medicines regulation in ratifying states: joint evaluation of selected products, inspections and support to national regulators, which still authorise medicines. AMATA, a patient, civil-society and industry alliance, campaigns for ratification; it is an advocacy alliance, not a law (https://www.iapo.org.uk/amata).',
    reformNote: 'The Agency\'s Kigali headquarters opened in November 2024 and its first Director General was appointed in June 2025; it is still building its operations. The AU reported 32 ratifications in May 2026; the country statuses here follow the December 2025 list of 31 (which includes the Sahrawi Republic), so one recent ratification is not yet shown.',
    source: { url: 'https://au-ama.africa/', kind: 'official', checked: CHECKED },
  },
])

/** Who has ratified each continental instrument. Every African country in the register is listed one way or the other. */
export const RATIFICATIONS = {
  afcfta: {
    asOf: '2025-09-03',
    source: 'https://static.pmg.org.za/250903_Ratification_AfCFTA_Protocols.pdf',
    /** 49 of 55 AU members had ratified; these had not (Eritrea has not signed). */
    notRatified: ['BJ', 'ER', 'LY', 'SO', 'SD', 'SS'],
  },
  ama: {
    asOf: '2025-12-31',
    source: 'https://www.frontiersin.org/journals/medicine/articles/10.3389/fmed.2026.1763261/full',
    /** Table 2 of the source (31 states, including the Sahrawi Republic, which is not in the register). */
    ratified: ['DZ', 'BJ', 'BW', 'BF', 'CM', 'CV', 'TD', 'CI', 'EG', 'ET', 'GA', 'GH', 'GN', 'KE', 'LS', 'ML', 'MU', 'MA', 'NA', 'NE', 'RW', 'SN', 'SC', 'SL', 'TZ', 'TN', 'UG', 'ZM', 'ZW', 'TG'],
  },
} as const

export type ContinentalInstrument = keyof typeof RATIFICATIONS
const NON_AU = ['EU', 'UK', 'US']

/** True or false for an African country; null outside the African Union. */
export function ratificationStatus(instrument: ContinentalInstrument, jurisdiction: string): boolean | null {
  if (NON_AU.includes(jurisdiction) || jurisdiction === 'AU') return null
  return instrument === 'afcfta'
    ? !(RATIFICATIONS.afcfta.notRatified as readonly string[]).includes(jurisdiction)
    : (RATIFICATIONS.ama.ratified as readonly string[]).includes(jurisdiction)
}

/** Which instrument a continental register entry is, if any. */
export function instrumentOf(e: Pick<LawEntry, 'jurisdiction' | 'title'>): ContinentalInstrument | null {
  if (e.jurisdiction !== 'AU') return null
  return /Continental Free Trade Area/.test(e.title) ? 'afcfta' : /African Medicines Agency/.test(e.title) ? 'ama' : null
}

