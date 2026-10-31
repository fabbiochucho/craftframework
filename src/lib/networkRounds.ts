// Network assessment rounds: one instrument, one window, everyone in a level's scope. Members submit a snapshot of
// their scores so rounds stay comparable. Optional perspectives (from ActionAid's OCAT method): board, management,
// staff, community and a facilitator each score the domains, and the gaps between them are a result in their own
// right. Self-check: `node src/lib/networkRounds.test.ts`.
import { FOUNDATION_MODULES, applicableIndicators, type FoundationModule } from './foundationModules.ts'

export const PERSPECTIVES = ['board', 'management', 'staff', 'community', 'facilitator'] as const
export type Perspective = (typeof PERSPECTIVES)[number]
export const PERSPECTIVE_LABEL: Record<Perspective, string> = {
  board: 'Board or governing body', management: 'Management', staff: 'Staff and volunteers',
  community: 'Community representatives', facilitator: 'External facilitator',
}
/** A spread this wide (on the 0-5 scale) between perspectives is worth talking about. */
export const DISAGREEMENT = 2

export type RoundState = 'upcoming' | 'open' | 'closed'
export interface Round { opensOn: string; closesOn: string; closedAt?: string | null }

/** Dates are whole days (YYYY-MM-DD); a round is open through its closing day. */
export function roundState(r: Round, today: string): RoundState {
  if (r.closedAt || today > r.closesOn) return 'closed'
  return today < r.opensOn ? 'upcoming' : 'open'
}

export const validWindow = (opensOn: string, closesOn: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(opensOn) && /^\d{4}-\d{2}-\d{2}$/.test(closesOn) && opensOn <= closesOn

/** Instruments a round can use: every CRAFT module (more are registered as they are added). */
/** Instruments a round can use. Modules still in preview (content awaiting sign-off) are offered to the Super Admin only. */
export const roundInstruments = (includePreview = false): Array<{ id: string; title: string }> =>
  FOUNDATION_MODULES.filter((m) => includePreview || !m.preview).map((m) => ({ id: m.id, title: m.title }))
export const instrumentById = (id: string): FoundationModule | undefined => FOUNDATION_MODULES.find((m) => m.id === id)

/** How far an organisation is through the instrument. */
export function progress(m: FoundationModule, scores: Record<string, number>) {
  const ids = applicableIndicators(m).map((i) => i.id)
  const answered = ids.filter((id) => scores[id] != null).length
  return { answered, total: ids.length, complete: ids.length > 0 && answered === ids.length }
}

/** The instrument's scores only, frozen at submission. */
export function snapshot(m: FoundationModule, scores: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const i of applicableIndicators(m)) if (scores[i.id] != null) out[i.id] = scores[i.id]
  return out
}

/** Perspective scores are whole numbers 0-5 for known dimensions only. */
export function validPerspectiveScores(m: FoundationModule, scores: Record<string, number>): boolean {
  const dims = new Set(m.dimensions.map((d) => d.key))
  const entries = Object.entries(scores)
  return entries.length > 0 && entries.every(([k, v]) => dims.has(k) && Number.isInteger(v) && v >= 0 && v <= 5)
}

/** Per dimension: the lowest and highest perspective, and whether they disagree enough to discuss. */
export function perspectiveGaps(m: FoundationModule, byPerspective: Partial<Record<Perspective, Record<string, number>>>) {
  return m.dimensions.map((d) => {
    const vals = (Object.entries(byPerspective) as Array<[Perspective, Record<string, number>]>)
      .filter(([, s]) => s[d.key] != null).map(([p, s]) => ({ perspective: p, score: s[d.key] }))
    if (vals.length < 2) return { dimension: d.key, name: d.name, values: vals, spread: null as number | null, disagree: false }
    const scores = vals.map((v) => v.score)
    const spread = Math.max(...scores) - Math.min(...scores)
    return { dimension: d.key, name: d.name, values: vals, spread, disagree: spread >= DISAGREEMENT }
  })
}

/** Participation counts for a set of members; safe to show without suppression (says nothing about results). */
export function participation(acceptedOrgIds: string[], started: Set<string>, submitted: Set<string>) {
  const total = acceptedOrgIds.length
  const sub = acceptedOrgIds.filter((o) => submitted.has(o)).length
  const inProgress = acceptedOrgIds.filter((o) => !submitted.has(o) && started.has(o)).length
  return { total, submitted: sub, inProgress, notStarted: total - sub - inProgress, rate: total ? Math.round((sub / total) * 100) : 0 }
}
