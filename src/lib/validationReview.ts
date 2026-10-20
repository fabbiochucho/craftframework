// ============================================================================
// CRAFT validator system — review, Trust Delta, outcome and freeze (PR 3)
// ----------------------------------------------------------------------------
// Pure rules shared by /api/validation-reviews and the review page. Framework
// agnostic: a framework is registered by key with its indicators, levels and
// rung function. See craft-internal/docs/superpowers/specs/2026-10-16-validator-system.md
// ("Review, outcome and freeze").
// ============================================================================

import { blockingIndicators, currentRung, LADDER_INDICATORS, LADDER_LEVELS, levelAchieved, levelScore } from './capitalReadiness.ts'
import { optimismBias, paperCompliancePenalty } from './frameworks.ts'
import type { EngagementScope } from './engagements.ts'
import { applicableIndicators, bandFor, FOUNDATION_MODULES, type ModuleProfile } from './foundationModules.ts'

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
  /** 'rung': a ladder of levels (the engagement's framework). 'band': a CRAFT index, validated alongside it (spec §7). */
  result: 'rung' | 'band'
  /** Band frameworks: the band label the scores earn, or null when nothing is answered. */
  band?: (scores: Record<string, number>, p?: ModuleProfile) => string | null
  /** Band frameworks: the indicators that apply to an organisation with this module profile. */
  indicatorsFor?: (p?: ModuleProfile) => FrameworkIndicator[]
  name: string
  version: string
  /** legacy-state key holding the organisation's self-scores (Record<indicatorId, 0-5>) */
  scoresKey: string
  levels: Array<{ level: number; name: string }>
  indicators: FrameworkIndicator[]
  rung: (scores: Record<string, number>) => number
  levelScore: (level: number, scores: Record<string, number>) => number
  levelAchieved: (level: number, scores: Record<string, number>) => boolean
  /** Indicators (ids) holding back the next rung for these scores. */
  blocking: (scores: Record<string, number>) => string[]
}

export const FRAMEWORKS: Record<string, FrameworkDef> = {
  'capital-readiness': {
    key: 'capital-readiness', result: 'rung', name: 'CRAFT Capital Readiness Ladder', version: 'ICARF v4.0', scoresKey: 'capital:scores',
    levels: LADDER_LEVELS.map((l) => ({ level: l.level, name: l.name })),
    indicators: LADDER_INDICATORS.map((i) => ({ id: i.id, level: i.level, domain: i.domain, question: i.question })),
    rung: currentRung, levelScore, levelAchieved,
    blocking: (scores) => blockingIndicators(scores).map((i) => i.id),
  },
  ...indexFrameworks(),
}

// The v1 (102026) indices as band frameworks. Self-scores live in /api/responses ('responses').
// Which indicators apply follows the organisation's module profile ('modules:profile'), as in self-assessment.
function indexFrameworks(): Record<string, FrameworkDef> {
  const out: Record<string, FrameworkDef> = {}
  for (const m of FOUNDATION_MODULES.filter((x) => x.version === 'v1 (102026)')) {
    const toFw = (inds: typeof m.indicators): FrameworkIndicator[] =>
      inds.map((i) => ({ id: i.id, level: 0, domain: m.dimensions.find((d) => d.key === i.dimension)?.name ?? i.dimension, question: i.question }))
    out[m.id] = {
      key: m.id, result: 'band', name: `CRAFT ${m.title}`, version: m.version ?? '', scoresKey: 'responses', levels: [],
      indicators: toFw(m.indicators),
      indicatorsFor: (p) => toFw(applicableIndicators(m, p)),
      rung: () => 0, levelScore: () => 0, levelAchieved: () => false,
      blocking: (scores) => m.indicators.filter((i) => scores[i.id] != null && scores[i.id] <= 2).map((i) => i.id),
      band: (scores, p) => bandFor(m, scores, p)?.band.label ?? null,
    }
  }
  return out
}

export type ScopedIndicator = FrameworkIndicator & { framework: string }

/** The band frameworks (indices) in an engagement's scope. */
export function scopeIndices(scope: EngagementScope): FrameworkDef[] {
  return (scope.indices ?? []).map((k) => FRAMEWORKS[k]).filter((f): f is FrameworkDef => !!f && f.result === 'band')
}

/** Every indicator in scope: the ladder's in-scope levels, then each index's indicators that apply to the organisation. */
export function allInScope(fw: FrameworkDef, scope: EngagementScope, profile?: ModuleProfile): ScopedIndicator[] {
  return [
    ...indicatorsInScope(fw, scope).map((i) => ({ ...i, framework: fw.key })),
    ...scopeIndices(scope).flatMap((f) => (f.indicatorsFor?.(profile) ?? f.indicators).map((i) => ({ ...i, framework: f.key }))),
  ]
}

export type IndexResult = { key: string; name: string; version: string; band: string | null }

/** The band each index in scope earns on the final scores. Bands only: never scores or evidence. */
export function indexResults(scope: EngagementScope, final: Record<string, number>, profile?: ModuleProfile): IndexResult[] {
  return scopeIndices(scope).map((f) => ({ key: f.key, name: f.name, version: f.version, band: f.band!(cleanScores(final, new Set(f.indicators.map((i) => i.id))), profile) }))
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

export type PaperCap = { negotiated: number; capped: number; message: string }

/**
 * Paper-compliance cap: a negotiated score above 2 on an indicator whose evidence the validator marked
 * 'insufficient' stands at 2 (frameworks.paperCompliancePenalty). Only negotiated scores are capped; the
 * validator's own score is their judgement of the evidence and is never altered.
 */
export function paperCaps(negotiated: Record<string, number>, sufficiency: Record<string, Sufficiency | null | undefined>): Record<string, PaperCap> {
  const out: Record<string, PaperCap> = {}
  for (const [id, score] of Object.entries(negotiated)) {
    const p = paperCompliancePenalty(score, sufficiency[id] === 'insufficient')
    if (p.triggered) out[id] = { negotiated: score, capped: p.cappedScore ?? 2, message: p.message ?? '' }
  }
  return out
}

/** The negotiated scores that stand after the paper-compliance cap. */
export function cappedNegotiated(negotiated: Record<string, number>, caps: Record<string, PaperCap>): Record<string, number> {
  return Object.fromEntries(Object.entries(negotiated).map(([id, n]) => [id, caps[id]?.capped ?? n]))
}

/** A scope that includes level 1 supports a rung; any other scope can only confirm the levels it covers. */
export function supportsRung(scope: EngagementScope): boolean {
  return scope.kind === 'whole' || scope.levels.includes(1)
}

export type LevelConfirmation = { level: number; name: string; achieved: boolean }

/** Every level in scope, with whether the final scores achieve it (the "confirmed levels" of a partial scope). */
export function levelConfirmations(fw: FrameworkDef, scores: Record<string, number>, scope: EngagementScope): LevelConfirmation[] {
  const achieved = new Set(levelsAchieved(fw, scores, scope))
  const levels = [...new Set(indicatorsInScope(fw, scope).map((i) => i.level))].sort((a, b) => a - b)
  return levels.map((level) => ({ level, name: fw.levels.find((l) => l.level === level)?.name ?? `Level ${level}`, achieved: achieved.has(level) }))
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
  id: string; framework: string; level: number; domain: string; question: string
  self: number | null; validator: number | null; delta: number | null; optimismBias: number | null
}
export type TrustDeltaRowWithCap = TrustDeltaRow & { negotiated: number | null; paperCap: PaperCap | null; final: number | null }

/** Self vs validator score per in-scope indicator (live, as the validator scores). */
export function trustDelta(fw: FrameworkDef, scope: EngagementScope, self: Record<string, number>, validator: Record<string, number>, profile?: ModuleProfile): TrustDeltaRow[] {
  return allInScope(fw, scope, profile).map((i) => {
    const s = self[i.id] ?? null
    const v = validator[i.id] ?? null
    return {
      id: i.id, framework: i.framework, level: i.level, domain: i.domain, question: i.question, self: s, validator: v,
      delta: s != null && v != null ? s - v : null,
      optimismBias: s != null && v != null ? optimismBias({ prScore: s, assessorScore: v }) : null,
    }
  })
}

/** Trust Delta rows with the negotiated score, any paper-compliance cap on it, and the score that stands. */
export function trustDeltaWithCaps(
  fw: FrameworkDef, scope: EngagementScope, self: Record<string, number>, validator: Record<string, number>,
  negotiated: Record<string, number>, sufficiency: Record<string, Sufficiency | null | undefined>, profile?: ModuleProfile,
): TrustDeltaRowWithCap[] {
  const caps = paperCaps(negotiated, sufficiency)
  return trustDelta(fw, scope, self, validator, profile).map((t) => ({
    ...t, negotiated: negotiated[t.id] ?? null, paperCap: caps[t.id] ?? null, final: caps[t.id]?.capped ?? negotiated[t.id] ?? validator[t.id] ?? null,
  }))
}

export type Qualification = { id?: string; text: string; indicatorIds: string[] }

export type FinaliseInput = {
  fw: FrameworkDef
  scope: EngagementScope
  validatorScores: Record<string, number>
  negotiated: Record<string, number>
  /** The validator's evidence sufficiency per indicator; drives the paper-compliance cap on negotiated scores. */
  sufficiency?: Record<string, Sufficiency | null | undefined>
  method: Method | null
  fieldworkStart: string | null
  fieldworkEnd: string | null
  outcome: Outcome | null
  qualifications: Qualification[]
  now?: Date
  /** The organisation's module profile: which index indicators apply. */
  profile?: ModuleProfile
}

/** Everything that stops a review being finalised, as plain sentences. Empty = ready. */
export function finalisationProblems(i: FinaliseInput): string[] {
  const problems: string[] = []
  const inScope = allInScope(i.fw, i.scope, i.profile)
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
    const final = finalScores(i.validatorScores, cappedNegotiated(i.negotiated, paperCaps(i.negotiated, i.sufficiency ?? {})))
    if (supportsRung(i.scope)) {
      if (impliedRung(i.fw, final, i.scope) < 1) problems.push('No rung is supported by these scores, so the outcome must be "Not validated"')
    } else {
      // A partial scope confirms levels, not a rung: "validated" needs every level in scope confirmed, a qualified outcome at least one.
      const confirmed = levelConfirmations(i.fw, final, i.scope)
      const achieved = confirmed.filter((c) => c.achieved).length
      if (i.outcome === 'validated' && achieved < confirmed.length) problems.push('A plain "validated" outcome needs every level in scope confirmed; choose "Validated with qualifications" or "Not validated"')
      else if (i.outcome === 'validated_with_qualifications' && achieved < 1) problems.push('No level in scope is confirmed by these scores, so the outcome must be "Not validated"')
    }
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

/** Only a rung framework (the ladder) can be an engagement's framework; indices are added through scope.indices. */
export const isPrimaryFramework = (key: string): boolean => FRAMEWORKS[key]?.result === 'rung'

/** Indicators a validation's improvement actions may link: the framework's, plus every indicator its frozen review covered. */
export function knownIndicatorIds(fw: FrameworkDef | undefined, snapshot: unknown): Set<string> {
  const ids = new Set((fw?.indicators ?? []).map((i) => i.id))
  const list = (snapshot as { indicators?: unknown } | null)?.indicators
  if (Array.isArray(list)) for (const i of list) if (i && typeof (i as { id?: unknown }).id === 'string') ids.add((i as { id: string }).id)
  return ids
}
