// Bulk organisation invitations from a CSV: one organisation per row. Columns (header names, any order,
// case-insensitive): organisation (or name), email, contact (optional), type (optional: Public / Civil
// Society / Private, or a sector such as NGO, CBO, Faith-Based, Ministry), country (optional: name or ISO).
// Sample: public/templates/craft-organisation-invitations-sample.csv
import { ARCHETYPES, type Archetype } from './data'
import { SECTORS_BY_ARCHETYPE } from './dataroom'
import { COUNTRIES } from './countries'

export type BulkRow = { orgName: string; email: string; contact: string; orgArchetype: Archetype | ''; orgSector: string; orgCountry: string; problem: string | null }

/** Minimal CSV parser: commas, quoted fields with "" escapes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ } else if (c === '"') q = false
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((x) => x.trim())) rows.push(row)
  return rows
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** CSV text -> checked rows (or a message when the header is unusable). */
export function rowsFromCsv(text: string): { rows: BulkRow[] } | { error: string } {
  const table = parseCsv(text.replace(/^﻿/, ''))
  if (table.length < 2) return { error: 'The file needs a header row and at least one organisation.' }
  const head = table[0].map(norm)
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h))
  const iName = col('organisation', 'organization', 'name', 'organisation name', 'organization name')
  const iEmail = col('email', 'contact email', 'email address')
  if (iName < 0 || iEmail < 0) return { error: 'Columns "organisation" and "email" are required (plus optional contact, type, country).' }
  const iContact = col('contact', 'contact name', 'coordinator', 'contact person')
  const iType = col('type', 'organisation type', 'organization type', 'sector', 'category')
  const iCountry = col('country')
  const seen = new Set<string>()
  const rows = table.slice(1).map((cells): BulkRow => {
    const get = (i: number) => (i >= 0 ? (cells[i] ?? '').trim() : '')
    const email = get(iEmail).toLowerCase()
    const r: BulkRow = { orgName: get(iName), email, contact: get(iContact), orgArchetype: '', orgSector: '', orgCountry: '', problem: null }
    const type = norm(get(iType))
    if (type) {
      const arch = ARCHETYPES.find((a) => norm(a.id) === type || norm(a.label) === type || (type === 'cso' && a.id === 'Civil Society'))
      if (arch) r.orgArchetype = arch.id
      else {
        for (const [a, sectors] of Object.entries(SECTORS_BY_ARCHETYPE) as Array<[Archetype, string[]]>) {
          const s = sectors.find((x) => norm(x) === type)
          if (s) { r.orgArchetype = a; r.orgSector = s; break }
        }
        if (!r.orgArchetype) r.problem = `Unknown type "${get(iType)}"`
      }
    }
    const country = get(iCountry)
    if (country) {
      const c = COUNTRIES.find((x) => x.code.toLowerCase() === country.toLowerCase() || norm(x.name) === norm(country))
      if (c) r.orgCountry = c.code
      else r.problem = r.problem ?? `Unknown country "${country}"`
    }
    if (r.orgName.length < 2) r.problem = 'Organisation name missing'
    else if (!EMAIL.test(email)) r.problem = `Invalid email "${get(iEmail)}"`
    else if (seen.has(email)) r.problem = 'Same email twice in this file'
    seen.add(email)
    return r
  })
  return { rows }
}

