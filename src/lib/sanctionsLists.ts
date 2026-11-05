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

/**
 * RFC 4180-style CSV rows, one at a time: quoted fields, doubled quotes, separators and newlines inside quotes. Fields
 * are cut out with slices and rows are not kept, so a 50 MB list parses in a small, steady amount of memory.
 */
export function* csvRows(text: string, sep = ','): Generator<string[]> {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0
  const n = text.length
  while (i < n) {
    const row: string[] = []
    for (;;) {
      let field: string
      if (text[i] === '"') {
        // Quoted: join the pieces between doubled quotes.
        let out = '', start = i + 1
        for (;;) {
          const q = text.indexOf('"', start)
          if (q < 0) { out += text.slice(start); i = n; break }
          if (text[q + 1] === '"') { out += text.slice(start, q + 1); start = q + 2; continue }
          out += text.slice(start, q); i = q + 1; break
        }
        // Anything between the closing quote and the separator is kept, as a lenient reader would.
        let k = i
        while (k < n && text[k] !== sep && text[k] !== '\n' && text[k] !== '\r') k++
        field = out + text.slice(i, k); i = k
      } else {
        let k = i
        while (k < n && text[k] !== sep && text[k] !== '\n' && text[k] !== '\r') k++
        field = text.slice(i, k); i = k
      }
      row.push(field.trim())
      if (i < n && text[i] === sep) { i++; if (i === n) { row.push(''); break } continue }
      if (text[i] === '\r' && text[i + 1] === '\n') i += 2
      else if (i < n) i++
      break
    }
    yield row
  }
}

/** Every CSV row at once (for small files and tests). */
export const parseCsv = (text: string, sep = ','): string[][] => [...csvRows(text, sep)]

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const nonEmpty = (xs: (string | undefined)[]) => [...new Set(xs.map(clean).filter((x) => x && x !== '-0-'))]
const years = (xs: (string | undefined)[]) => [...new Set(xs.map((x) => Number((x ?? '').match(/(19|20)\d{2}/)?.[0])).filter((n) => n > 1900))]
const lc = (xs: string[]) => [...new Set(xs.map((x) => x.toLowerCase()))]

/** OFAC: SDN.CSV (no header: ent_num, name, type, …), ALT.CSV (aliases), ADD.CSV (addresses with country). Vessels and aircraft are skipped. */
export function parseOfac(sdn: string, alt: string, add: string): ListEntry[] {
  const aliases = new Map<string, string[]>(), countries = new Map<string, string[]>()
  for (const r of csvRows(alt)) if (r[0]) aliases.set(r[0], [...(aliases.get(r[0]) ?? []), r[3]])
  for (const r of csvRows(add)) if (r[0]) countries.set(r[0], [...(countries.get(r[0]) ?? []), r[4]])
  const out: ListEntry[] = []
  for (const r of csvRows(sdn)) {
    const kind = clean(r[2]).toLowerCase()
    if (!r[0] || !r[1] || kind === 'vessel' || kind === 'aircraft') continue
    out.push({ source: 'ofac', id: r[0], type: kind === 'individual' ? 'person' : 'organisation', names: nonEmpty([r[1], ...(aliases.get(r[0]) ?? [])]), countries: lc(nonEmpty(countries.get(r[0]) ?? [])), birthYears: years([r[11]]), ids: [] })
  }
  return out
}

/** UK Sanctions List CSV: a "Report Date" line, a header row, then one row per name, grouped by Unique ID. Ships are skipped. */
export function parseUk(text: string): ListEntry[] {
  const rows = csvRows(text)
  let head: string[] | undefined
  // next(), not for…of with break: breaking would close the generator before the data rows.
  for (let x = rows.next(); !x.done; x = rows.next()) if (x.value.includes('Unique ID')) { head = x.value; break }
  if (!head) return []
  const col = (name: string) => head.indexOf(name)
  const c = { id: col('Unique ID'), n6: col('Name 6'), n: [1, 2, 3, 4, 5].map((i) => col(`Name ${i}`)), type: col('Designation Type'), country: col('Address Country'), nat: col('Nationality(/ies)'), cob: col('Country of birth'), dob: col('D.O.B'), nid: col('National Identifier number'), pass: col('Passport number'), reg: col('Business registration number (s)') }
  const by = new Map<string, ListEntry>()
  for (const r of rows) {
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
  const rows = csvRows(text, ';')
  const head = rows.next().value ?? [], col = (name: string) => head.indexOf(name)
  const c = { id: col('Entity_LogicalId'), type: col('Entity_SubjectType'), code: col('Entity_SubjectType_ClassificationCode'), name: col('NameAlias_WholeName'), country: col('Address_CountryDescription'), cit: col('Citizenship_CountryDescription'), year: col('BirthDate_Year'), ident: col('Identification_Number') }
  const by = new Map<string, ListEntry>()
  for (const r of rows) {
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
