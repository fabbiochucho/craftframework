// Where DiBadili stands on each "What CRAFT must do" duty. Kept apart from the reviewed register data, so updating
// a status never changes LAW_DATA_VERSION. Evidence lives in craft-internal docs/governance/.
import type { CraftDuty } from './types.ts'

export type DutyStatus = 'done' | 'needed' | 'n/a' | 'watch'
/** Countries where CRAFT markets to, or has a meaningful number of, users. Add a country here when that changes. */
export const TARGETED: string[] = ['NG']
const HOME = 'NG'
const BREACH = 'Covered by the breach response procedure (craft-internal docs/governance/breach-response-procedure.md), which lists this regulator and deadline.'
const NOT_TRIGGERED = 'Not triggered: CRAFT does not target users here yet. Act before marketing to, or onboarding a meaningful number of users in, this country (data-protection registration roadmap).'

/** The status to show for a duty; `note` is the register's note. Returns the evidence to show alongside it. */
export function resolveDuty(jurisdiction: string, duty: CraftDuty, note: string): { status: DutyStatus; evidence: string } {
  if (duty === 'breach-notice') return { status: 'done', evidence: BREACH }
  if (jurisdiction === HOME) {
    if (duty === 'registration') return { status: 'done', evidence: 'Registered with the NDPC: NDPC/DPC/15933 (4 November 2026).' }
    if (duty === 'local-representative') return { status: 'n/a', evidence: 'DiBadili is established in Nigeria.' }
    if (duty === 'cross-border') return { status: 'done', evidence: 'Transfer record (craft-internal docs/governance/transfer-record.md) and the privacy policy’s International transfers section.' }
  }
  if (/^No .*requirement identified/.test(note)) return { status: 'n/a', evidence: 'The register records no such requirement.' }
  if (TARGETED.includes(jurisdiction)) return { status: 'needed', evidence: '' }
  return { status: 'watch', evidence: NOT_TRIGGERED }
}
