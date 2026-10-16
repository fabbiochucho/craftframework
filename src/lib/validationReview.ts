// ============================================================================
// CRAFT validator system — review, Trust Delta, outcome and freeze (PR 3)
// ----------------------------------------------------------------------------
// Pure rules shared by /api/validation-reviews and the review page. Framework
// agnostic: a framework is registered by key with its indicators, levels and
// rung function. See docs/superpowers/specs/2026-10-16-validator-system.md
// ("Review, outcome and freeze").
// ============================================================================

import { currentRung, LADDER_INDICATORS, LADDER_LEVELS, levelAchieved, levelScore } from './capitalReadiness.ts'
import { optimismBias } from './frameworks.ts'
import type { EngagementScope } from './engagements.ts'

export const METHODS = ['document_review', 'sample_testing', 'interviews', 'site_visit', 'combined'] as const
export type Method = (typeof METHODS)[number]
export const METHOD_LABEL: Record<Method, string> = {
  document_review: 'Document review', sample_testing: 'Sample testing', interviews: 'Interviews', site_visit: 'Site visit', combined: 'Combined',
}

export const SUFFICIENCY = ['sufficient', 'partial', 'insufficient'] as const
export type Sufficiency = (typeof SUFFICIENCY)[number]

export const OUTCOMES = ['validated', 'validated_with_qualifications', 'not_validated'] as const
export type Outcome = (typeof OUTCOMES)[number]
export const OUTCOME_LABEL: Record<Outcome, string> = {
  validated: 'Validated', validated_with_qualifications: 'Validated with qualifications', not_validated: 'Not validated',
}

export const REVIEW_STATUSES = ['draft', 'debrief', 'finalised'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export type FrameworkIndicator = { id: string; level: number; domain: string; question: string }
export type FrameworkDef = {
  key: string
  name: string
  version: string
  /** legacy-state key holding the organisation's self-scores (Record<indicatorId, 0-5>) */
  scoresKey: string
  levels: Array<{ level: number; name: string }>
  indicators: FrameworkIndicator[]
  rung: (scores: Record<string, number>) => number
  levelScore: (level: number, scores: Record<string, number>) => number
  levelAchieved: (level: number, scores: Record<string, number>) => boolean
}

export const FRAMEWORKS: Record<string, FrameworkDef> = {
  'capital-readiness': {
    key: 'capital-readiness', name: 'CRAFT Capital Readiness Ladder', version: 'ICARF v4.0', scoresKey: 'capital:scores',
    levels: LADDER_LEVELS.map((l) => ({ level: l.level, name: l.name })),
    indicators: LADDER_INDICATORS.map((i) => ({ id: i.id, level: i.level, domain: i.domain, question: i.question })),
    rung: currentRung, levelScore, levelAchieved,
  },
}

/** Indicators in an engagement's scope (whole framework or the listed levels). */
export function indicatorsInScope(fw: FrameworkDef, scope: EngagementScope): FrameworkIndicator[] {
  return scope.kind === 'whole' ? fw.indicators : fw.indicators.filter((i) => scope.levels.includes(i.level))
}

const isScore = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 5

/** Only valid 0-5 scores for in-scope indicators, from untrusted stored data. */
export function cleanScores(input: unknown, ids: Set<string>): Record<string, number> {
  const out: Record<string, number> = {}
  if (input && typeof input === 'object') for (const [k, v] of Object.entries(input as Record<string, unknown>)) if (ids.has(k) && isScore(v)) out[k] = v
  return out
}

/** The scores that stand: the negotiated score where one was recorded, else the validator's own. */
export function finalScores(validator: Record<string, number>, negotiated: Record<string, number>): Record<string, number> {
  return { ...validator, ...negotiated }
}

/**
 * The rung a set of scores supports. Out-of-scope indicators are never assumed, so a scope that
 * does not start at level 1 supports no rung; its achieved levels are reported separately.
 */
export function impliedRung(fw: FrameworkDef, scores: Record<string, number>, scope: EngagementScope): number {
  const ids = new Set(indicatorsInScope(fw, scope).map((i) => i.id))
  return fw.rung(cleanScores(scores, ids))
}

export function levelsAchieved(fw: FrameworkDef, scores: Record<string, number>, scope: EngagementScope): number[] {
  const inScope = indicatorsInScope(fw, scope)
  const ids = new Set(inScope.map((i) => i.id))
  const clean = cleanScores(scores, ids)
  return [...new Set(inScope.map((i) => i.level))].filter((l) => fw.levelAchieved(l, clean))
}

export type TrustDeltaRow = {
  id: string; level: number; domain: string; question: string
  self: number | null; validator: number | null; delta: number | null; optimismBias: number | null
}

/** Self vs validator score per in-scope indicator (live, as the validator scores). */
export function trustDelta(fw: FrameworkDef, scope: EngagementScope, self: Record<string, number>, validator: Record<string, number>): TrustDeltaRow[] {
  return indicatorsInScope(fw, scope).map((i) => {
    const s = self[i.id] ?? null
    const v = validator[i.id] ?? null
    return {
      id: i.id, level: i.level, domain: i.domain, question: i.question, self: s, validator: v,
      delta: s != null && v != null ? s - v : null,
      optimismBias: s != null && v != null ? optimismBias({ prScore: s, assessorScore: v }) : null,
    }
  })
}

export type Qualification = { id?: string; text: string; indicatorIds: string[] }

export type FinaliseInput = {
  fw: FrameworkDef
  scope: EngagementScope
  validatorScores: Record<string, number>
  negotiated: Record<string, number>
  method: Method | null
  fieldworkStart: string | null
  fieldworkEnd: string | null
  outcome: Outcome | null
  qualifications: Qualification[]
  now?: Date
}

/** Everything that stops a review being finalised, as plain sentences. Empty = ready. */
export function finalisationProblems(i: FinaliseInput): string[] {
  const problems: string[] = []
  const inScope = indicatorsInScope(i.fw, i.scope)
  const missing = inScope.filter((x) => i.validatorScores[x.id] == null)
  if (missing.length) problems.push(`Score every indicator in scope (${missing.length} not yet scored)`)
  if (!i.method) problems.push('Record the method used')
  if (!i.fieldworkStart || !i.fieldworkEnd) problems.push('Record the fieldwork dates')
  else {
    if (i.fieldworkEnd < i.fieldworkStart) problems.push('Fieldwork cannot end before it starts')
    const today = (i.now ?? new Date()).toISOString().slice(0, 10)
    if (i.fieldworkEnd > today) problems.push('Fieldwork dates cannot be in the future')
  }
  if (!i.outcome) problems.push('Choose an outcome')
  const ids = new Set(inScope.map((x) => x.id))
  for (const q of i.qualifications) {
    if (!q.text.trim()) problems.push('Every qualification needs wording')
    if (!q.indicatorIds.length || q.indicatorIds.some((x) => !ids.has(x))) problems.push('Link every qualification to indicators in scope')
  }
  if (i.outcome === 'validated_with_qualifications' && !i.qualifications.length) problems.push('List at least one qualification')
  if (i.outcome === 'validated' && i.qualifications.length) problems.push('A plain "validated" outcome cannot carry qualifications')
  if (i.outcome && i.outcome !== 'not_validated' && !missing.length) {
    const rung = impliedRung(i.fw, finalScores(i.validatorScores, i.negotiated), i.scope)
    if (rung < 1) problems.push('No rung is supported by these scores, so the outcome must be "Not validated"')
  }
  return problems
}

/** Stable JSON (sorted keys) so the same snapshot always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}
