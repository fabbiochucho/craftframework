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
