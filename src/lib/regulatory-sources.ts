// Register of the regulatory sources CRAFT relies on, so teams re-verify them before each
// reporting cycle. Sources come from the checklist jurisdiction packs and the 54-country registry;
// verification records are kept per workspace. Self-check: `node src/lib/regulatory-sources.test.ts`.
import { AFRICA_COUNTRIES, COUNTRY_DATA_VERSION, COUNTRY_SOURCES } from './africa-countries.ts'
import { JURISDICTIONS } from './esg-checklist.ts'

export const REVERIFY_AFTER_DAYS = 365
export const CHECK_OUTCOMES = ['confirmed', 'changed', 'unreachable'] as const
export type CheckOutcome = (typeof CHECK_OUTCOMES)[number]

export interface RegulatorySource {
  key: string
  kind: 'jurisdiction_pack' | 'country_profile'
  country: string
  title: string
  url: string
  catalogueVerified: string | null // date CRAFT last confirmed it
  toVerify: string[] // fields CRAFT has not confirmed
}

export function regulatorySources(): RegulatorySource[] {
  const packs = JURISDICTIONS.filter((j) => j.code !== 'OTHER').map((j): RegulatorySource => ({
    key: `jur:${j.code}`, kind: 'jurisdiction_pack', country: j.name, title: `IFRS S1/S2 adoption — ${j.sourceTitle}`, url: j.sourceUrl,
    catalogueVerified: j.lastVerified, toVerify: j.requiresVerification ? ['adoption status and dates'] : [],
  }))
  const profiles = AFRICA_COUNTRIES.map((c): RegulatorySource => ({
    key: `afr:${c.iso2}`, kind: 'country_profile', country: c.name, title: `Capital-market and institutional profile (${COUNTRY_DATA_VERSION})`,
    url: COUNTRY_SOURCES.exchanges.url, catalogueVerified: c.verify.length ? null : COUNTRY_SOURCES.exchanges.checked, toVerify: c.verify,
  }))
  return [...packs, ...profiles].sort((a, b) => a.country.localeCompare(b.country) || a.kind.localeCompare(b.kind))
}
export const sourceByKey = (key: string) => regulatorySources().find((s) => s.key === key) ?? null

export type SourceStatus = 'verified' | 'due' | 'changed' | 'unverified'
/** Status of a source given the workspace's latest check (if any) on `today` (YYYY-MM-DD). */
export function sourceStatus(s: RegulatorySource, latest: { outcome: string; checkedAt: string } | null, today: string): { status: SourceStatus; lastVerified: string | null; dueOn: string | null } {
  if (latest?.outcome === 'changed') return { status: 'changed', lastVerified: latest.checkedAt.slice(0, 10), dueOn: today }
  const confirmed = latest?.outcome === 'confirmed' ? latest.checkedAt.slice(0, 10) : null
  const lastVerified = [confirmed, s.toVerify.length ? null : s.catalogueVerified].filter(Boolean).sort().at(-1) ?? null
  if (!lastVerified) return { status: 'unverified', lastVerified: null, dueOn: today }
  const due = new Date(Date.parse(lastVerified) + REVERIFY_AFTER_DAYS * 86_400_000).toISOString().slice(0, 10)
  return { status: due <= today ? 'due' : 'verified', lastVerified, dueOn: due }
}
