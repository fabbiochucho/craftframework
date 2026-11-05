// Validator review rigour: the five control checks behind every validator score, and "not evidenced".
// A validator records whether the arrangement behind an indicator is designed, authorised, supported by a system,
// working in practice (tested) and traceable, plus whether it is adequate for the organisation and sustainable
// without outside support. The checks cap the score, so a policy that exists only on paper cannot score highly.
// Self-check: `node src/lib/controlChecks.test.ts`.

export const CHECK_VALUES = ['yes', 'no', 'not_tested'] as const
export type CheckValue = (typeof CHECK_VALUES)[number]

export const CONTROL_CHECKS = [
  { key: 'design', label: 'Designed', help: 'An appropriate policy, control or process exists.' },
  { key: 'authorisation', label: 'Authorised', help: 'Approved by the right authority and assigned to named people.' },
  { key: 'systemSupport', label: 'System support', help: 'Built into or enforced by a system. Manual is allowed but noted.' },
  { key: 'operating', label: 'Works in practice', help: 'Tested on samples and found to operate consistently.' },
  { key: 'traceability', label: 'Traceable', help: 'Records show what happened and who was responsible.' },
  { key: 'adequacy', label: 'Adequate', help: 'Right for the organisation\'s size, complexity and risk.' },
  { key: 'sustainability', label: 'Sustainable', help: 'Can keep running without temporary outside support.' },
] as const
export type CheckKey = (typeof CONTROL_CHECKS)[number]['key']
export type ControlChecks = Partial<Record<CheckKey, CheckValue>>

export const RESULTS = ['scored', 'not_evidenced'] as const
export type ScoreResult = (typeof RESULTS)[number]

export const isComplete = (c: ControlChecks | null | undefined): boolean => CONTROL_CHECKS.every(({ key }) => !!c?.[key])

/**
 * The highest score the checks allow, with the reason for each limit. A check that was not tested counts as not met:
 * a validator cannot credit what they did not examine. System support is noted but never caps.
 *   not designed → 1 · not authorised → 2 · not shown to work, or not traceable, or not adequate → 3 · not sustainable → 4
 */
export function scoreCap(c: ControlChecks): { max: number; reasons: string[] } {
  const met = (k: CheckKey) => c[k] === 'yes'
  const limits: [boolean, number, string][] = [
    [!met('design'), 1, 'not designed'],
    [!met('authorisation'), 2, 'not authorised'],
    [!met('operating'), 3, c.operating === 'not_tested' ? 'not tested in practice' : 'does not work in practice'],
    [!met('traceability'), 3, 'not traceable'],
    [!met('adequacy'), 3, 'not adequate for the organisation'],
    [!met('sustainability'), 4, 'not sustainable without outside support'],
  ]
  const hit = limits.filter(([on]) => on)
  const max = Math.min(5, ...hit.map(([, n]) => n))
  return { max, reasons: hit.filter(([, n]) => n === max).map(([, , r]) => r) }
}

/** Why a score is not allowed, or null when it is. Not evidenced is always recorded as 0 and needs no checks. */
export function scoreProblem(result: ScoreResult, score: number, checks: ControlChecks): string | null {
  if (result === 'not_evidenced') return score === 0 ? null : 'A "not evidenced" result is recorded as 0'
  if (!isComplete(checks)) return 'Record all seven checks before scoring'
  const cap = scoreCap(checks)
  return score > cap.max ? `The checks allow at most ${cap.max} (${cap.reasons.join(', ')})` : null
}

export const CHECK_LABEL: Record<CheckValue, string> = { yes: 'Yes', no: 'No', not_tested: 'Not tested' }
