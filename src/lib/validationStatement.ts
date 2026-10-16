// ============================================================================
// CRAFT validator system — public verification page and statement PDF (PR 6)
// ----------------------------------------------------------------------------
// Pure helpers shared by /api/public/validation, the statement PDF and the
// public page. The standard wording is the spec's, verbatim (it gets a lawyer
// review before launch, so keep it in ONE place). See
// docs/superpowers/specs/2026-10-16-validator-system.md ("Public verification
// page and statement PDF").
// ============================================================================

export const VERIFICATION_PREFIX = 'CRAFT-V-'
// Crockford base32: no I, L, O or U, so an ID read aloud or off a printout is hard to get wrong.
export const ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const VERIFICATION_ID_RE = /^CRAFT-V-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/

/** A random, non-sequential ID: CRAFT-V- plus 8 base32 characters (40 bits). `bytes` is injectable for tests. */
export function generateVerificationId(bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(8))): string {
  let id = ''
  for (let i = 0; i < 8; i++) id += ID_ALPHABET[bytes[i] % 32]
  return VERIFICATION_PREFIX + id
}

/** Tolerant lookup: trims, upper-cases and fixes the characters base32 leaves out. Null if it cannot be an ID. */
export function normaliseVerificationId(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const s = input.trim().toUpperCase().replace(/\s+/g, '')
  const body = s.startsWith('CRAFT-V-') ? s.slice(8) : s.startsWith('CRAFTV') ? s.slice(6).replace(/^-/, '') : null
  if (body === null) return null
  const fixed = body.replace(/O/g, '0').replace(/[IL]/g, '1')
  const id = VERIFICATION_PREFIX + fixed
  return VERIFICATION_ID_RE.test(id) ? id : null
}

export type WordingInput = { type: 'independent_validation' | 'funder_review'; frameworkName: string; frameworkVersion: string; funderName?: string | null }

/** The three paragraphs of the standard wording (spec, verbatim). `means` differs for a funder review. */
export function standardWording(i: WordingInput): { means: string; doesNot: string; changes: string } {
  const fw = `${i.frameworkName} (${i.frameworkVersion})`
  const means = i.type === 'funder_review'
    ? `Staff of ${i.funderName ?? 'the funding partner'} have reviewed the organisation's self-assessment and supporting evidence against the ${fw}. The reviewers are employed by the funder and are not independent of it. Any qualifications listed form part of this conclusion.`
    : `An accredited validator, independent of the organisation, has reviewed the organisation's self-assessment and supporting evidence against the ${fw}, using the method and scope stated above, ` +
      'and has concluded that the organisation met the requirements for the rung shown on the dates of the review. Any qualifications listed form part of this conclusion.'
  return {
    means,
    doesNot: 'It is not an audit or review of financial statements, and not a guarantee of the organisation\'s future performance, solvency, or use of funds. ' +
      'It does not cover matters outside the stated scope, and it reflects evidence available to the validator at the time; it may not reflect events after the review date. ' +
      'It is not an endorsement by DiBadili Institute or the engaging party, and it does not replace the due diligence of anyone deciding to fund, lend to, or partner with the organisation.',
    changes: 'A validation is valid only while it shows as current on its verification page. It may be suspended after a material event, or withdrawn if new evidence shows it was wrong. Always check the verification page before relying on a copy.',
  }
}

export const CONCERN_CATEGORIES = ['inaccurate', 'conduct', 'material_event', 'other'] as const
export type ConcernCategory = (typeof CONCERN_CATEGORIES)[number]
export const CONCERN_LABEL: Record<ConcernCategory, string> = {
  inaccurate: 'The result looks inaccurate', conduct: 'Concern about the validator\'s conduct', material_event: 'Something material has happened at the organisation', other: 'Something else',
}

export type PublicOptions = {
  registrationNumber?: string
  showRungHistory?: boolean
  showQualifications?: boolean
  devmapperUrl?: string
}

/** Untrusted organisation input -> the only public options we keep. https links only. */
export function cleanPublicOptions(input: unknown): PublicOptions {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const out: PublicOptions = {}
  if (typeof o.registrationNumber === 'string' && o.registrationNumber.trim()) out.registrationNumber = o.registrationNumber.trim().slice(0, 100)
  if (o.showRungHistory === true) out.showRungHistory = true
  if (o.showQualifications === true) out.showQualifications = true
  if (typeof o.devmapperUrl === 'string' && o.devmapperUrl.trim()) {
    try {
      const u = new URL(o.devmapperUrl.trim())
      if (u.protocol === 'https:' && u.href.length <= 300) out.devmapperUrl = u.href
    } catch { /* not a URL: dropped */ }
  }
  return out
}
