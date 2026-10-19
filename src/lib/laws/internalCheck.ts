// What each law means for CRAFT itself, which entries need re-checking, and what is still awaiting review. Super Admin only.
import { jurisdictionName, type CraftDuty, type LawEntry } from './types.ts'

export interface InternalCheck {
  duties: { jurisdiction: string; law: string; duty: CraftDuty; note: string; status: 'done' | 'needed' | 'n/a' }[]
  recheckDue: LawEntry[]
  pending: { jurisdiction: string; count: number }[]
}
const ORDER = { needed: 0, done: 1, 'n/a': 2 } as const

/** `today` is YYYY-MM-DD; an entry is due for re-checking once its source was checked more than 12 months ago. */
export function buildInternalCheck(entries: LawEntry[], today: string, approvedJurisdictions: string[] = []): InternalCheck {
  const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`
  const duties = entries.flatMap((e) => (e.craftNotes ?? []).map((n) => ({ jurisdiction: jurisdictionName(e.jurisdiction), law: e.title, ...n })))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.jurisdiction.localeCompare(b.jurisdiction))
  const counts = new Map<string, number>()
  for (const e of entries) if (e.review === 'pending' && !approvedJurisdictions.includes(e.jurisdiction)) counts.set(e.jurisdiction, (counts.get(e.jurisdiction) ?? 0) + 1)
  return {
    duties,
    recheckDue: entries.filter((e) => e.source.checked < yearAgo),
    pending: [...counts].map(([jurisdiction, count]) => ({ jurisdiction, count })),
  }
}
