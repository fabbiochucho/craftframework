// Free official sanctions lists, parsed into one shape and matched locally (names never leave CRAFT):
// UN Security Council consolidated list (XML), US OFAC SDN (CSV + aliases + addresses), EU consolidated financial
// sanctions (CSV), UK Sanctions List (CSV; the single UK source since the OFSI list closed on 28 January 2026).
// Self-check: `node src/lib/sanctionsLists.test.ts`.

export type ListEntry = { source: ListSource; id: string; type: 'person' | 'organisation'; names: string[]; countries: string[]; birthYears: number[]; ids: string[] }
export const LIST_SOURCES = ['un', 'ofac', 'eu', 'uk'] as const
export type ListSource = (typeof LIST_SOURCES)[number]
export const SOURCE_DATASET: Record<ListSource, string> = { un: 'un_sc_sanctions', ofac: 'us_ofac_sdn', eu: 'eu_fsf', uk: 'gb_sanctions_list' }
export const SOURCE_URLS: Record<ListSource, string[]> = {
  un: ['https://scsanctions.un.org/resources/xml/en/consolidated.xml'],
  ofac: ['SDN', 'ALT', 'ADD'].map((f) => `https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/${f}.CSV`),
  eu: ['https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw'],
  uk: ['https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv'],
}

/** RFC 4180-style CSV: quoted fields, doubled quotes, separators and newlines inside quotes. */
export function parseCsv(text: string, sep = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += ch
    } else if (ch === '"') q = true
    else if (ch === sep) { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.map((r) => r.map((x) => x.replace(/^﻿/, '').trim()))
}

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const nonEmpty = (xs: (string | undefined)[]) => [...new Set(xs.map(clean).filter((x) => x && x !== '-0-'))]
const years = (xs: (string | undefined)[]) => [...new Set(xs.map((x) => Number((x ?? '').match(/(19|20)\d{2}/)?.[0])).filter((n) => n > 1900))]
const lc = (xs: string[]) => [...new Set(xs.map((x) => x.toLowerCase()))]

/** OFAC: SDN.CSV (no header: ent_num, name, type, …), ALT.CSV (aliases), ADD.CSV (addresses with country). Vessels and aircraft are skipped. */
export function parseOfac(sdn: string, alt: string, add: string): ListEntry[] {
  const aliases = new Map<string, string[]>(), countries = new Map<string, string[]>()
  for (const r of parseCsv(alt)) if (r[0]) aliases.set(r[0], [...(aliases.get(r[0]) ?? []), r[3]])
  for (const r of parseCsv(add)) if (r[0]) countries.set(r[0], [...(countries.get(r[0]) ?? []), r[4]])
  const out: ListEntry[] = []
  for (const r of parseCsv(sdn)) {
    const kind = clean(r[2]).toLowerCase()
    if (!r[0] || !r[1] || kind === 'vessel' || kind === 'aircraft') continue
    out.push({ source: 'ofac', id: r[0], type: kind === 'individual' ? 'person' : 'organisation', names: nonEmpty([r[1], ...(aliases.get(r[0]) ?? [])]), countries: lc(nonEmpty(countries.get(r[0]) ?? [])), birthYears: years([r[11]]), ids: [] })
  }
  return out
}

/** UK Sanctions List CSV: a "Report Date" line, a header row, then one row per name, grouped by Unique ID. Ships are skipped. */
export function parseUk(text: string): ListEntry[] {
  const rows = parseCsv(text)
  const h = rows.findIndex((r) => r.includes('Unique ID'))
  if (h < 0) return []
  const head = rows[h], col = (name: string) => head.indexOf(name)
  const c = { id: col('Unique ID'), n6: col('Name 6'), n: [1, 2, 3, 4, 5].map((i) => col(`Name ${i}`)), type: col('Designation Type'), country: col('Address Country'), nat: col('Nationality(/ies)'), cob: col('Country of birth'), dob: col('D.O.B'), nid: col('National Identifier number'), pass: col('Passport number'), reg: col('Business registration number (s)') }
  const by = new Map<string, ListEntry>()
  for (const r of rows.slice(h + 1)) {
    const id = r[c.id]
    if (!id || /ship/i.test(r[c.type] ?? '')) continue
    const name = clean([...c.n.map((i) => r[i]), r[c.n6]].filter(Boolean).join(' '))
    const e = by.get(id) ?? { source: 'uk' as const, id, type: /individual/i.test(r[c.type] ?? '') ? 'person' as const : 'organisation' as const, names: [], countries: [], birthYears: [], ids: [] }
    e.names = nonEmpty([...e.names, name])
    e.countries = lc(nonEmpty([...e.countries, r[c.country], ...(r[c.nat] ?? '').split(/[,;]/), r[c.cob]]))
    e.birthYears = [...new Set([...e.birthYears, ...years([r[c.dob]])])]
    e.ids = nonEmpty([...e.ids, r[c.nid], r[c.pass], r[c.reg]])
    by.set(id, e)
  }
  return [...by.values()]
}

/** EU consolidated list CSV (semicolon-separated, one row per name/address/birth date), grouped by Entity_LogicalId. */
export function parseEu(text: string): ListEntry[] {
  const rows = parseCsv(text, ';')
  const head = rows[0] ?? [], col = (name: string) => head.indexOf(name)
  const c = { id: col('Entity_LogicalId'), type: col('Entity_SubjectType'), code: col('Entity_SubjectType_ClassificationCode'), name: col('NameAlias_WholeName'), country: col('Address_CountryDescription'), cit: col('Citizenship_CountryDescription'), year: col('BirthDate_Year'), ident: col('Identification_Number') }
  const by = new Map<string, ListEntry>()
  for (const r of rows.slice(1)) {
    const id = r[c.id]
    if (!id) continue
    const e = by.get(id) ?? { source: 'eu' as const, id, type: r[c.type] === 'P' || r[c.code] === 'person' ? 'person' as const : 'organisation' as const, names: [], countries: [], birthYears: [], ids: [] }
    e.names = nonEmpty([...e.names, r[c.name]])
    e.countries = lc(nonEmpty([...e.countries, r[c.country], c.cit >= 0 ? r[c.cit] : '']))
    e.birthYears = [...new Set([...e.birthYears, ...years([r[c.year]])])]
    if (c.ident >= 0) e.ids = nonEmpty([...e.ids, r[c.ident]])
    by.set(id, e)
  }
  return [...by.values()]
}

// One pass, so an escaped entity such as &amp;quot; is decoded once, to &quot;, never twice.
const ENTITIES: Record<string, string> = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>' }
const tag = (block: string, t: string) => [...block.matchAll(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, 'g'))].map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/&(amp|apos|quot|lt|gt);/g, (_, e: string) => ENTITIES[e]).trim())

/** UN consolidated XML: INDIVIDUAL and ENTITY blocks with names, aliases, nationality or address country, birth year. */
export function parseUn(xml: string): ListEntry[] {
  const out: ListEntry[] = []
  for (const [kind, type] of [['INDIVIDUAL', 'person'], ['ENTITY', 'organisation']] as const) {
    for (const m of xml.matchAll(new RegExp(`<${kind}>([\\s\\S]*?)</${kind}>`, 'g'))) {
      const b = m[1]
      const name = clean(['FIRST_NAME', 'SECOND_NAME', 'THIRD_NAME', 'FOURTH_NAME'].map((t) => tag(b, t)[0] ?? '').join(' '))
      const nationality = [...b.matchAll(/<NATIONALITY>([\s\S]*?)<\/NATIONALITY>/g)].flatMap((x) => tag(x[1], 'VALUE'))
      out.push({
        source: 'un', id: tag(b, 'REFERENCE_NUMBER')[0] ?? tag(b, 'DATAID')[0] ?? name, type,
        names: nonEmpty([name, ...tag(b, 'ALIAS_NAME')]), countries: lc(nonEmpty([...nationality, ...tag(b, 'COUNTRY')])),
        birthYears: years(tag(b, 'YEAR')), ids: nonEmpty(tag(b, 'NUMBER')),
      })
    }
  }
  return out
}
