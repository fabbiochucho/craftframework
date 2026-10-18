import { PHASE1_LAWS } from './data/phase1.ts'
import { NORTH_LAWS } from './data/north.ts'
import { WEST_LAWS } from './data/west.ts'
import { CENTRAL_LAWS } from './data/central.ts'
import { EAST_LAWS } from './data/east.ts'
import type { LawEntry } from './types.ts'

export const LAW_DATA_VERSION = 'CRAFT-LAW 1.0 (2026-10-18)'
/** Every batch's entries. Phase 2 batches are appended here as their data files land. */
export const LAW_REGISTER: LawEntry[] = [...PHASE1_LAWS, ...NORTH_LAWS, ...WEST_LAWS, ...CENTRAL_LAWS, ...EAST_LAWS]

export function lawsFor(jurisdictions: string[], opts: { approvedOnly?: boolean } = {}): LawEntry[] {
  return LAW_REGISTER.filter((e) => jurisdictions.includes(e.jurisdiction) && (!opts.approvedOnly || e.review === 'approved'))
}
