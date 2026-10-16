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

// A validator is 'active' or 'suspended' (platform admin, reason required).
// Accreditation is never granted by hand: completing the CRAFT training (PR 7)
// sets `accreditedUntil`, one year ahead; it lapses unless renewed annually.
export const VALIDATOR_STATUSES = ['active', 'suspended'] as const
export type ValidatorStatus = (typeof VALIDATOR_STATUSES)[number]

export function natureOptions(kind: FirmKind): readonly string[] {
  return kind === 'funding_partner' ? FUNDER_TYPES : FIRM_NATURES
}

type AccreditationInput = { status: string; accreditedUntil: Date | string | null }

// What the directory shows. Suspension always wins (and stays visible, with a
// badge, for transparency); otherwise accredited until `accreditedUntil`, then
// lapsed until the annual renewal is done.
export function effectiveAccreditation(v: AccreditationInput, now = new Date()): 'registered' | 'accredited' | 'lapsed' | 'suspended' {
  if (v.status === 'suspended') return 'suspended'
  if (!v.accreditedUntil) return 'registered'
  return new Date(v.accreditedUntil).getTime() > now.getTime() ? 'accredited' : 'lapsed'
}

// Levels from the spec. Senior / Lead need validation history (later PRs).
export function validatorLevel(v: AccreditationInput, now = new Date()): 'Associate' | 'Validator' {
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
