import { PHASE1_LAWS } from './data/phase1.ts'
import type { LawEntry } from './types.ts'

export const LAW_DATA_VERSION = 'CRAFT-LAW 1.0 (2026-10-18)'
/** Every batch's entries. Phase 2 batches are appended here as their data files land. */
export const LAW_REGISTER: LawEntry[] = [...PHASE1_LAWS]

export function lawsFor(jurisdictions: string[], opts: { approvedOnly?: boolean } = {}): LawEntry[] {
  return LAW_REGISTER.filter((e) => jurisdictions.includes(e.jurisdiction) && (!opts.approvedOnly || e.review === 'approved'))
}
