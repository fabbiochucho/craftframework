// Starter structures for a new network, so nobody has to build levels one by one.
// Self-check: `node src/lib/networkTemplates.test.ts`.
import { AFRICA_COUNTRIES, type AuRegion } from './africa-countries.ts'
import type { NetworkLevel } from './networks.ts'
import { AFRICA_SUBDIVISIONS } from './africaSubdivisions.ts'

export const NETWORK_TEMPLATES = ['blank', 'africa-regions-countries', 'nigeria-zones-states', 'cohort'] as const
export type NetworkTemplate = (typeof NETWORK_TEMPLATES)[number]
export const TEMPLATE_LABEL: Record<NetworkTemplate, string> = {
  blank: 'Start with one level and add the rest yourself',
  'africa-regions-countries': 'Africa → 5 AU regions → 54 countries',
  'nigeria-zones-states': 'Nigeria → 6 geopolitical zones → 36 states and the FCT',
  cohort: 'A funder cohort: one group of grantees',
}

/** A node to create: `key` and `parent` are local to the template; the first node is the top level. */
export interface TemplateNode { key: string; parent: string | null; level: NetworkLevel; name: string; geoCode: string }

const AU_REGION_CODE: Record<AuRegion, string> = { North: 'AU-NORTH', West: 'AU-WEST', Central: 'AU-CENTRAL', East: 'AU-EAST', Southern: 'AU-SOUTH' }

// Nigeria's geopolitical zones and their states (ISO 3166-2:NG codes).
const NIGERIA_ZONES: Array<[string, string, Array<[string, string]>]> = [
  ['NG-NC', 'North Central', [['BE', 'Benue'], ['KO', 'Kogi'], ['KW', 'Kwara'], ['NA', 'Nasarawa'], ['NI', 'Niger'], ['PL', 'Plateau'], ['FC', 'Federal Capital Territory']]],
  ['NG-NE', 'North East', [['AD', 'Adamawa'], ['BA', 'Bauchi'], ['BO', 'Borno'], ['GO', 'Gombe'], ['TA', 'Taraba'], ['YO', 'Yobe']]],
  ['NG-NW', 'North West', [['JI', 'Jigawa'], ['KD', 'Kaduna'], ['KN', 'Kano'], ['KT', 'Katsina'], ['KE', 'Kebbi'], ['SO', 'Sokoto'], ['ZA', 'Zamfara']]],
  ['NG-SE', 'South East', [['AB', 'Abia'], ['AN', 'Anambra'], ['EB', 'Ebonyi'], ['EN', 'Enugu'], ['IM', 'Imo']]],
  ['NG-SS', 'South South', [['AK', 'Akwa Ibom'], ['BY', 'Bayelsa'], ['CR', 'Cross River'], ['DE', 'Delta'], ['ED', 'Edo'], ['RI', 'Rivers']]],
  ['NG-SW', 'South West', [['EK', 'Ekiti'], ['LA', 'Lagos'], ['OG', 'Ogun'], ['ON', 'Ondo'], ['OS', 'Osun'], ['OY', 'Oyo']]],
]

/** The levels a template creates. `top` overrides the top level for blank and cohort networks. */
export function templateNodes(t: NetworkTemplate, top: { level: NetworkLevel; name: string; geoCode: string }): TemplateNode[] {
  if (t === 'africa-regions-countries') {
    const out: TemplateNode[] = [{ key: 'africa', parent: null, level: 'continental', name: 'Africa', geoCode: 'AU' }]
    for (const r of Object.keys(AU_REGION_CODE) as AuRegion[]) {
      out.push({ key: r, parent: 'africa', level: 'subregional', name: `${r} Africa`, geoCode: AU_REGION_CODE[r] })
      for (const c of AFRICA_COUNTRIES.filter((x) => x.region === r)) out.push({ key: c.iso2, parent: r, level: 'national', name: c.name, geoCode: c.iso2 })
    }
    return out
  }
  if (t === 'nigeria-zones-states') {
    const out: TemplateNode[] = [{ key: 'ng', parent: null, level: 'national', name: 'Nigeria', geoCode: 'NG' }]
    for (const [code, name, states] of NIGERIA_ZONES) {
      out.push({ key: code, parent: 'ng', level: 'zonal', name, geoCode: code })
      for (const [s, sn] of states) out.push({ key: `NG-${s}`, parent: code, level: 'subnational', name: sn, geoCode: `NG-${s}` })
    }
    return out
  }
  if (t === 'cohort') return [{ key: 'cohort', parent: null, level: top.level === 'local' ? 'national' : top.level, name: top.name, geoCode: top.geoCode }]
  return [{ key: 'top', parent: null, level: top.level, name: top.name, geoCode: top.geoCode }]
}

// ---- Guided structure: pick countries, how to group them, and how deep to go ----
export const GROUPINGS = ['au-region', 'rec', 'none'] as const
export interface StructureSpec {
  countries: string[] // ISO alpha-2, at least one
  grouping: (typeof GROUPINGS)[number] // used when there is more than one country; 'rec' groups by each country's first-listed REC
  zones: boolean // Nigeria only: geopolitical zones between country and states
  subdivisions: boolean // first-level states, provinces, regions or counties (ISO 3166-2)
}

function countryNodes(iso: string, parent: string | null, spec: StructureSpec): TemplateNode[] {
  const c = AFRICA_COUNTRIES.find((x) => x.iso2 === iso)!
  const out: TemplateNode[] = [{ key: iso, parent, level: 'national', name: c.name, geoCode: iso }]
  if (!spec.subdivisions) return out
  if (iso === 'NG' && spec.zones) {
    for (const [code, name, states] of NIGERIA_ZONES) {
      out.push({ key: code, parent: iso, level: 'zonal', name, geoCode: code })
      for (const [s, sn] of states) out.push({ key: `NG-${s}`, parent: code, level: 'subnational', name: sn, geoCode: `NG-${s}` })
    }
    return out
  }
  for (const [s, sn] of AFRICA_SUBDIVISIONS[iso] ?? []) out.push({ key: `${iso}-${s}`, parent: iso, level: 'subnational', name: sn, geoCode: `${iso}-${s}` })
  return out
}

/** The levels for a guided structure, parents first. One country is the top level; several sit under "Africa". */
export function buildStructure(spec: StructureSpec): TemplateNode[] {
  const isos = [...new Set(spec.countries)].filter((i) => AFRICA_COUNTRIES.some((c) => c.iso2 === i))
  if (!isos.length) throw new Error('Choose at least one country')
  if (isos.length === 1) return countryNodes(isos[0], null, spec)
  const out: TemplateNode[] = [{ key: 'africa', parent: null, level: 'continental', name: 'Africa', geoCode: 'AU' }]
  const groupOf = (iso: string): [string, string] | null => {
    const c = AFRICA_COUNTRIES.find((x) => x.iso2 === iso)!
    if (spec.grouping === 'au-region') return [AU_REGION_CODE[c.region], `${c.region} Africa`]
    if (spec.grouping === 'rec' && c.recs[0]) return [c.recs[0], c.recs[0]]
    return null
  }
  for (const iso of isos) {
    const g = groupOf(iso)
    if (g && !out.some((n) => n.key === `g:${g[0]}`)) out.push({ key: `g:${g[0]}`, parent: 'africa', level: 'subregional', name: g[1], geoCode: g[0] })
    out.push(...countryNodes(iso, g ? `g:${g[0]}` : 'africa', spec))
  }
  return out
}
