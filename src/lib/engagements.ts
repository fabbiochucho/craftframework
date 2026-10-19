// ============================================================================
// CRAFT validator system — engagements, teams and access (PR 2)
// ----------------------------------------------------------------------------
// Shared vocabulary and pure rules for validation engagements. Used by
// /api/engagements and the engagement pages. See
// docs/superpowers/specs/2026-10-16-validator-system.md ("Engagements, teams
// and access" and "Labels").
// ============================================================================

export const ENGAGEMENT_TYPES = ['independent_validation', 'funder_review'] as const
export type EngagementType = (typeof ENGAGEMENT_TYPES)[number]

export const ENGAGEMENT_STATUSES = ['proposed', 'active', 'declined', 'cancelled', 'expired', 'finalised'] as const
export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number]

// Each party's answer. 'not_required' = the party plays no part in this engagement type.
export const PARTY_STATUSES = ['pending', 'accepted', 'declined', 'not_required'] as const
export type PartyStatus = (typeof PARTY_STATUSES)[number]

export const SIDES = ['organization', 'validator', 'funder'] as const
export type Side = (typeof SIDES)[number]

export const DEFAULT_ACCESS_DAYS = 90
export const MAX_ACCESS_DAYS = 365
export const INVITE_VALID_DAYS = 30
export const GRANT_ROLE = 'craft_validator'

export const TYPE_LABEL: Record<EngagementType, string> = {
  independent_validation: 'Independent validation',
  funder_review: 'Funder review',
}

/** The ladder (whole or some levels), plus any v1 (102026) CRAFT indices validated alongside it (spec §7). */
export type EngagementScope = ({ kind: 'whole' } | { kind: 'levels'; levels: number[] }) & { indices?: string[] }

/** The CRAFT indices an engagement can include, in display order. */
export const INDEX_SCOPE_NAMES: Record<string, string> = {
  'craft-health': 'Organisational Effectiveness',
  'craft-change': 'Change Readiness & Adoption',
  'craft-fiduciary': 'Fiduciary Controls & Risk Management',
  'craft-safeguards': 'Environmental & Social Safeguards',
}

// Untrusted indices input -> a list of known, distinct index keys; [] for none; null when invalid.
function parseIndices(input: unknown): string[] | null {
  if (input == null) return []
  if (!Array.isArray(input)) return null
  if (new Set(input).size !== input.length || input.some((k) => typeof k !== 'string' || !(k in INDEX_SCOPE_NAMES))) return null
  return Object.keys(INDEX_SCOPE_NAMES).filter((k) => input.includes(k))
}

// Untrusted scope input -> a normalised scope, or null when invalid.
export function parseScope(input: unknown): EngagementScope | null {
  if (input == null) return { kind: 'whole' }
  const s = input as { kind?: unknown; levels?: unknown; indices?: unknown }
  const indices = parseIndices(s.indices)
  if (indices === null) return null
  const withIndices = <T extends object>(base: T) => (indices.length ? { ...base, indices } : base)
  if (s.kind === 'whole') return withIndices({ kind: 'whole' as const })
  if (s.kind === 'levels' && Array.isArray(s.levels)) {
    const unique = [...new Set(s.levels)]
    const levels = unique.filter((l): l is number => Number.isInteger(l) && l >= 1 && l <= 99).sort((a, b) => a - b)
    return levels.length && levels.length === unique.length ? withIndices({ kind: 'levels' as const, levels }) : null
  }
  return null
}

export function scopeText(scope: EngagementScope): string {
  const ladder = scope.kind === 'whole' ? 'Whole ladder' : `Levels ${scope.levels.join(', ')}`
  const indices = (scope.indices ?? []).map((k) => INDEX_SCOPE_NAMES[k] ?? k)
  return indices.length ? `${ladder}; CRAFT indices: ${indices.join(', ')}` : ladder
}

// An engagement is active once every required party has accepted. Any decline ends it.
export function engagementStatusFrom(
  parties: { org: PartyStatus; validator: PartyStatus; funder: PartyStatus },
  current: EngagementStatus = 'proposed',
): EngagementStatus {
  if (current !== 'proposed') return current
  const all = [parties.org, parties.validator, parties.funder]
  if (all.includes('declined')) return 'declined'
  return all.every((p) => p === 'accepted' || p === 'not_required') ? 'active' : 'proposed'
}

// Only a currently accredited validator may sit on an independent validation.
// Funder reviews are the funder's own staff, so accreditation is not required.
export function mayJoinTeam(type: EngagementType, accreditation: string | null): boolean {
  return type === 'funder_review' || accreditation === 'accredited'
}

// A funding partner's staff can only ever create a funder review.
export function mayCreateType(side: Side, type: EngagementType): boolean {
  return side !== 'funder' || type === 'funder_review'
}

// Access-window end for a named member's grant: mandatory, never past the engagement's own end.
export function grantExpiry(activatedAt: Date, accessDays: number): Date {
  const days = Math.min(Math.max(Math.floor(accessDays) || DEFAULT_ACCESS_DAYS, 1), MAX_ACCESS_DAYS)
  return new Date(activatedAt.getTime() + days * 86_400_000)
}

export type LabelMember = { name: string; accreditation: string }

// The three labels are never mixed. An independent validation whose named
// validator is no longer accredited reads "Review by [name]".
export function engagementLabel(e: { type: EngagementType; funderName?: string | null; engagedBy: string; members: LabelMember[] }): { label: string; statement: string } {
  if (e.type === 'funder_review') {
    return { label: 'Funder review', statement: `Reviewed by ${e.funderName ?? 'the funding partner'}` }
  }
  const names = e.members.map((m) => m.name)
  const lapsed = e.members.filter((m) => m.accreditation !== 'accredited')
  if (!e.members.length || lapsed.length) {
    return { label: 'Review', statement: `Review by ${(lapsed.length ? lapsed : e.members).map((m) => m.name).join(', ') || 'the named validator'}` }
  }
  return { label: 'Independent validation', statement: `Validated by ${names.join(', ')}, engaged by ${e.engagedBy}` }
}

// --- Independence and conflict-of-interest declaration (versioned) -------------
export type Declaration = { version: string; title: string; statements: string[]; fundedPrompt: string }

export const DECLARATIONS: Record<EngagementType, Declaration> = {
  independent_validation: {
    version: 'independence-2026-10-16.1',
    title: 'Independence and conflict-of-interest declaration',
    statements: [
      'I have no ownership, employment or advisory ties to this organisation.',
      'I took no part in preparing this organisation\'s self-assessment.',
      'I will keep everything I see confidential and use it only for this engagement.',
    ],
    fundedPrompt: 'I am engaged or paid by a funder connected to this organisation (disclose who and how below).',
  },
  funder_review: {
    version: 'funder-review-2026-10-16.1',
    title: 'Conflict-of-interest declaration for a funder review',
    statements: [
      'I understand this is a funder review: I am employed by the funding partner and am not independent of it.',
      'I took no part in preparing this organisation\'s self-assessment.',
      'I will keep everything I see confidential and use it only for this engagement.',
    ],
    fundedPrompt: 'I have another tie to this organisation (ownership, employment or advisory) — disclose below.',
  },
}

export const declarationFor = (type: EngagementType): Declaration => DECLARATIONS[type]
