// Programme Response Scorecard: how well a place (or an implementing body) runs a programme response, scored per
// programme area on four components with three traffic-light bands. Modelled on NACA's Subnational HIV Prevention
// Self-Assessment Scorecards (2023/2024), whose public report shows the components and items used below; NACA's own
// scoring thresholds are not published, so CRAFT's thresholds (BANDS) are used and labelled as CRAFT's.
// Self-check: `node src/lib/programmeScorecard.test.ts`.

export const COMPONENTS = ['management', 'implementation', 'package', 'outcome'] as const
export type Component = (typeof COMPONENTS)[number]
export const COMPONENT_LABEL: Record<Component, string> = {
  management: 'Programme management', implementation: 'Programme implementation', package: 'Service package', outcome: 'Programme outcome',
}

/** Each item is scored 0 (not in place), 1 (partly in place) or 2 (fully in place). */
export const ITEM_SCALE = [
  { value: 0, label: 'Not in place' }, { value: 1, label: 'Partly in place' }, { value: 2, label: 'Fully in place' },
] as const

export type Band = 'immediate' | 'attention' | 'good'
export const BAND_LABEL: Record<Band, string> = { immediate: 'Immediate action required', attention: 'Attention needed', good: 'Good, but may need improvement' }
/** CRAFT thresholds on the share of the maximum score (NACA's are not published). */
export const BANDS = { attentionFrom: 40, goodFrom: 70 }
export const bandFor = (pct: number): Band => (pct >= BANDS.goodFrom ? 'good' : pct >= BANDS.attentionFrom ? 'attention' : 'immediate')

export interface Area { key: string; name: string; items: Record<Component, Array<{ id: string; text: string }>> }
export interface Template { id: string; name: string; source: string; areas: Area[] }

const items = (prefix: string, list: string[]) => list.map((text, i) => ({ id: `${prefix}${i + 1}`, text }))
// Management and implementation items are the same for every area in NACA's report.
const management = (k: string, who: string) => items(`${k}.m`, [
  `A state strategy for HIV prevention for ${who}`, `State technical working group is functional and includes ${who}`,
  'Accountability mechanisms for data', 'A technical assistance and sustainability plan', 'Financing and budget planning',
])
const implementation = (k: string) => items(`${k}.i`, [
  'Demographic and needs assessment', 'Target setting and population estimation', 'Risk factor assessment',
  'Development of delivery systems', 'Monitoring and data management',
])

export const TEMPLATES: Template[] = [
  {
    id: 'hiv-prevention-subnational',
    name: 'Subnational HIV prevention response',
    source: "Components and the AGYW and programme-management items follow NACA's Subnational HIV Prevention Self-Assessment Scorecards 2023/2024 (public report). Condom service-package and outcome items are CRAFT placeholders. Confirm all wording with NACA before official use.",
    areas: [
      { key: 'agyw', name: 'Adolescent girls and young women (AGYW)', items: {
        management: management('agyw', 'AGYW'), implementation: implementation('agyw'),
        package: items('agyw.p', ['Education and social support', 'Youth-friendly health and HIV services', 'Social and economic empowerment', 'HIV prevention and risk reduction services', 'Community engagement']),
        outcome: items('agyw.o', ['HIV prevention and treatment indicators', 'Risk and prevention programmes', 'Male partner and community engagement', 'Violence and social indicators', 'Knowledge and education indicators']),
      } },
      { key: 'condom', name: 'Condom programming', items: {
        management: management('condom', 'condom programming'), implementation: implementation('condom'),
        package: items('condom.p', ['Condom supply and distribution', 'Demand creation and promotion', 'Targeted distribution to priority populations', 'Stock monitoring at service points']),
        outcome: items('condom.o', ['Condom use indicators', 'Distribution against targets', 'Availability at service points']),
      } },
    ],
  },
  {
    id: 'generic-programme-response',
    name: 'Programme response (any sector)',
    source: 'CRAFT generic template on the same four components, for TB, malaria, nutrition, education or any programme.',
    areas: [
      { key: 'programme', name: 'Programme', items: {
        management: items('programme.m', ['A current strategy for the programme', 'A functional coordination group that includes the people served', 'Accountability mechanisms for data', 'A technical assistance and sustainability plan', 'Financing and budget planning']),
        implementation: items('programme.i', ['Needs assessment', 'Target setting and population estimation', 'Risk and barrier assessment', 'Delivery systems in place', 'Monitoring and data management']),
        package: items('programme.p', ['Core services available', 'Services reach priority populations', 'Quality standards applied', 'Community engagement']),
        outcome: items('programme.o', ['Outcome indicators tracked', 'Results against targets', 'Equity of results across groups']),
      } },
    ],
  },
]
export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id)
export const allItemIds = (t: Template) => t.areas.flatMap((a) => COMPONENTS.flatMap((c) => a.items[c].map((i) => i.id)))

export function validEntry(t: Template, scores: Record<string, number>): boolean {
  const ids = new Set(allItemIds(t))
  return Object.entries(scores).every(([k, v]) => ids.has(k) && (v === 0 || v === 1 || v === 2))
}

/** One unit's result per area and component: percentage of the maximum, and its band. Unanswered items count as 0. */
export function scoreUnit(t: Template, scores: Record<string, number>) {
  return t.areas.map((a) => ({
    area: a.key, name: a.name,
    components: COMPONENTS.map((c) => {
      const list = a.items[c]
      const got = list.reduce((s, i) => s + (scores[i.id] ?? 0), 0)
      const pct = list.length ? Math.round((got / (list.length * 2)) * 100) : 0
      return { component: c, pct, band: bandFor(pct), gaps: list.filter((i) => (scores[i.id] ?? 0) < 2).map((i) => i.text) }
    }),
  }))
}

export interface UnitResult { nodeId: string; name: string; group: string; result: ReturnType<typeof scoreUnit> }

/** NACA-style summary for one area and component: units per band overall, per group (e.g. zone), and the lists. */
export function summarise(units: UnitResult[], area: string, component: Component) {
  const pick = (u: UnitResult) => u.result.find((r) => r.area === area)!.components.find((c) => c.component === component)!
  const bands: Band[] = ['immediate', 'attention', 'good']
  const groups = [...new Set(units.map((u) => u.group))].sort()
  return {
    counts: Object.fromEntries(bands.map((b) => [b, units.filter((u) => pick(u).band === b).length])) as Record<Band, number>,
    byGroup: groups.map((g) => ({ group: g, ...Object.fromEntries(bands.map((b) => [b, units.filter((u) => u.group === g && pick(u).band === b).length])) as Record<Band, number> })),
    lists: Object.fromEntries(bands.map((b) => [b, units.filter((u) => pick(u).band === b).map((u) => u.name).sort()])) as Record<Band, string[]>,
  }
}

/** Change for each unit present in both scorecards: band moves per area and component. */
export function changeSince(t: Template, before: Array<{ nodeId: string; scores: Record<string, number> }>, after: Array<{ nodeId: string; scores: Record<string, number> }>) {
  const order: Band[] = ['immediate', 'attention', 'good']
  const prev = new Map(before.map((b) => [b.nodeId, scoreUnit(t, b.scores)]))
  let improved = 0, worsened = 0, same = 0
  for (const a of after) {
    const p = prev.get(a.nodeId)
    if (!p) continue
    const now = scoreUnit(t, a.scores)
    now.forEach((area, ai) => area.components.forEach((c, ci) => {
      const d = order.indexOf(c.band) - order.indexOf(p[ai].components[ci].band)
      if (d > 0) improved++; else if (d < 0) worsened++; else same++
    }))
  }
  return { comparedUnits: after.filter((a) => prev.has(a.nodeId)).length, improved, worsened, same }
}
