// The type of organisation an inviter is bringing onto CRAFT (invitation wizard step 1): one of the
// CRAFT archetypes, optionally a sector from that archetype's list, and optionally a country.
// Shared by the wizard (client) and invitation creation (server), so both accept the same values.
import { ARCHETYPES, type Archetype } from './data'
import { SECTORS_BY_ARCHETYPE } from './dataroom'
import { COUNTRIES } from './countries'

export type OrgType = { archetype: Archetype; sector?: string; country?: string }

/** Untrusted input -> an organisation type, null when none was given, 'invalid' when it is not on the lists. */
export function parseOrgType(input: { archetype?: unknown; sector?: unknown; country?: unknown }): OrgType | null | 'invalid' {
  const { archetype, sector, country } = input
  if (archetype == null || archetype === '') return sector || country ? 'invalid' : null
  if (typeof archetype !== 'string' || !ARCHETYPES.some((a) => a.id === archetype)) return 'invalid'
  const a = archetype as Archetype
  const out: OrgType = { archetype: a }
  if (sector != null && sector !== '') {
    if (typeof sector !== 'string' || !SECTORS_BY_ARCHETYPE[a].includes(sector)) return 'invalid'
    out.sector = sector
  }
  if (country != null && country !== '') {
    if (typeof country !== 'string' || !COUNTRIES.some((c) => c.code === country)) return 'invalid'
    out.country = country
  }
  return out
}

export const countryNameOf = (code?: string | null): string => (code ? COUNTRIES.find((c) => c.code === code)?.name ?? '' : '')

/** "Civil Society · NGO · Nigeria" */
export function describeOrgType(t: { archetype?: string | null; sector?: string | null; country?: string | null } | null | undefined): string {
  if (!t?.archetype) return ''
  const label = ARCHETYPES.find((a) => a.id === t.archetype)?.label ?? t.archetype
  return [label, t.sector, countryNameOf(t.country)].filter(Boolean).join(' · ')
}
