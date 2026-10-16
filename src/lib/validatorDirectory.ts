// ============================================================================
// CRAFT validator system — profiles and the three-way directory (PR 1)
// ----------------------------------------------------------------------------
// Shared vocabulary and pure rules for validator profiles, validator firms,
// funding partners and the organisation opt-in listing. Used by both the
// /api/directory function and the directory pages. See
// docs/superpowers/specs/2026-10-16-validator-system.md.
// ============================================================================

export const FIRM_NATURES = [
  'Independent consultant', 'Audit firm', 'Accounting firm', 'Consulting firm',
  'NGO/CSO', 'Academic institution', 'Other',
] as const

export const FUNDER_TYPES = [
  'Venture Capital', 'Private Equity', 'DFI', 'Angel Investor',
  'Institutional Investor', 'Microfinance Bank', 'Other investor',
] as const

// `firms.kind`: null keeps the original consulting-firm behaviour (client books);
// these two kinds make a firm a directory profile.
export const FIRM_KINDS = ['validator_firm', 'funding_partner'] as const
export type FirmKind = (typeof FIRM_KINDS)[number]

export const ACCREDITATION_STATUSES = ['registered', 'accredited', 'suspended'] as const
// What a platform admin may set: suspend, or reinstate (never grants accreditation).
export const ADMIN_ACCREDITATION_ACTIONS = ['suspended', 'registered'] as const
export type AccreditationStatus = (typeof ACCREDITATION_STATUSES)[number]

export function natureOptions(kind: FirmKind): readonly string[] {
  return kind === 'funding_partner' ? FUNDER_TYPES : FIRM_NATURES
}

// What the directory shows. Accreditation is earned only through the training
// programme (PR 4): it exists solely as `accredited_until`, set server-side when all
// three assessment parts are passed and extended by annual renewal. Past that date it
// shows as "lapsed" (no badge). Suspension always wins. There is no manual or pilot
// accreditation, so the old `pilotAccredited` switch and a bare 'accredited' status
// no longer count.
export type EffectiveAccreditation = 'registered' | 'accredited' | 'lapsed' | 'suspended'
export function effectiveAccreditation(v: { accreditationStatus: string; accreditedUntil?: Date | string | null }, now = new Date()): EffectiveAccreditation {
  if (v.accreditationStatus === 'suspended') return 'suspended'
  if (!v.accreditedUntil) return 'registered'
  return new Date(v.accreditedUntil).getTime() > now.getTime() ? 'accredited' : 'lapsed'
}

// Levels from the spec. Senior / Lead need validation history (later PRs).
export function validatorLevel(v: { accreditationStatus: string; accreditedUntil?: Date | string | null }, now = new Date()): 'Associate' | 'Validator' {
  return effectiveAccreditation(v, now) === 'accredited' ? 'Validator' : 'Associate'
}

export function credentialLabel(c: { verifiedAt: Date | string | null }): 'verified' | 'self-declared' {
  return c.verifiedAt ? 'verified' : 'self-declared'
}

// Trimmed, de-duplicated, bounded list of short labels from untrusted input.
export function cleanList(input: unknown, max = 20, maxLen = 80): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const v of input) {
    if (typeof v !== 'string') continue
    const s = v.trim().slice(0, maxLen)
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s)
    if (out.length >= max) break
  }
  return out
}

// Case-insensitive match of a free-text query against a profile's searchable
// text; every word must appear somewhere.
export function matchesQuery(fields: Array<string | null | undefined | string[]>, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = fields.flat().filter(Boolean).join(' ').toLowerCase()
  return words.every((w) => hay.includes(w))
}
