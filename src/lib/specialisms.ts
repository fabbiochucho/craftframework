// Specialist accreditation for the specialist CRAFT indices (spec §7). Pure; shared by server and UI.
// A specialism is granted on passing its specialist assessment and counts only while the
// validator's main accreditation is current, so it renews (and lapses) with it.
import type { EngagementScope } from './engagements.ts'

export const SPECIALISMS = ['fiduciary', 'safeguards'] as const
export type Specialism = (typeof SPECIALISMS)[number]

export const SPECIALISM_LABEL: Record<Specialism, string> = {
  fiduciary: 'Fiduciary Controls & Risk Management',
  safeguards: 'Environmental & Social Safeguards',
}
/** The index that needs each specialism, and the training module that teaches it. */
export const SPECIALISM_INDEX: Record<Specialism, string> = { fiduciary: 'craft-fiduciary', safeguards: 'craft-safeguards' }
export const SPECIALISM_MODULE: Record<Specialism, string> = { fiduciary: 's1', safeguards: 's2' }

export const SPECIALIST_EXAM = { questions: 15, minutes: 30, passPct: 80, graceSeconds: 60 } as const

const isSpecialism = (s: string): s is Specialism => (SPECIALISMS as readonly string[]).includes(s)
export const specialismForModule = (moduleId: string): Specialism | null =>
  SPECIALISMS.find((s) => SPECIALISM_MODULE[s] === moduleId) ?? null

export function requiredSpecialisms(scope: EngagementScope): Specialism[] {
  const indices = scope.indices ?? []
  return SPECIALISMS.filter((s) => indices.includes(SPECIALISM_INDEX[s]))
}

export function missingSpecialisms(scope: EngagementScope, held: string[]): Specialism[] {
  return requiredSpecialisms(scope).filter((s) => !held.includes(s))
}

/** The specialisms that count now: only while the main accreditation is current. */
export function heldSpecialisms(rows: Array<{ specialism: string }>, accreditation: string): Specialism[] {
  if (accreditation !== 'accredited') return []
  return [...new Set(rows.map((r) => r.specialism).filter(isSpecialism))]
}

export function specialistPassed(score: number, total: number): boolean {
  return total > 0 && score >= Math.ceil((total * SPECIALIST_EXAM.passPct) / 100 - 1e-9)
}

export const missingSpecialismMessage = (missing: Specialism[]) =>
  `This engagement includes a specialist index. Every validator on it needs the ${missing.map((s) => SPECIALISM_LABEL[s]).join(' and ')} specialism.`

/** Specialist modules (s1, s2, ...) sit outside the core programme: not needed for accreditation or renewal. */
export const isSpecialistModuleId = (id: string) => /^s\d+$/.test(id)
