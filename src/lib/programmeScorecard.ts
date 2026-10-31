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

export interface Area { key: string; name: string; items: Partial<Record<Component, Array<{ id: string; text: string }>>> }
export interface Template { id: string; name: string; source: string; areas: Area[] }

/** The components an area is scored on (NACA scores some areas without a service-package component). */
export const componentsOf = (a: Area): Component[] => COMPONENTS.filter((c) => (a.items[c]?.length ?? 0) > 0)

const items = (prefix: string, list: string[]) => list.map((text, i) => ({ id: `${prefix}${i + 1}`, text }))
// Item lists as published in NACA's Subnational HIV Prevention Self-Assessment Scorecards 2023/2024 report.
const implementation = (k: string) => items(`${k}.i`, [
  'Demographic and needs assessment', 'Target setting and population estimation', 'Risk factor assessment',
  'Development of delivery systems', 'Monitoring and data management',
])
const kpManagement = (k: string) => items(`${k}.m`, [
  'State key populations strategy', 'Accountability and coordination', 'Technical working group and capacity building',
  'Sustainability and transition planning', 'Laws, policies and financing',
])
const kpImplementation = (k: string) => items(`${k}.i`, [
  'Demographic assessment and epidemiological data', 'Needs assessment and target setting', 'Implementation arrangements and management structure',
  'Service delivery and clinical interventions', 'Programme monitoring and quality assessment',
])
const tgItems = [
  'Population size, prevalence and prevention strategy', 'HIV testing, treatment and viral suppression targets (90-90-90)',
  'Access to HIV prevention interventions and condom use', 'Stigma, discrimination and criminalisation impacts', 'Provision of gender-affirmative health care',
]

export const TEMPLATES: Template[] = [
  {
    id: 'hiv-prevention-subnational',
    name: 'Subnational HIV prevention response',
    source: "Programme areas, components and items as published in NACA's Subnational HIV Prevention Self-Assessment Scorecards 2023/2024 report. NACA's scoring rules and thresholds are not published; CRAFT's are used.",
    areas: [
      { key: 'agyw', name: 'Adolescent girls and young women (AGYW)', items: {
        management: items('agyw.m', ['A state strategy for HIV prevention for AGYW', 'State technical working group functionality and inclusion of AGYW', 'Accountability mechanisms for data', 'A technical assistance and sustainability plan', 'Financing and budget planning']),
        implementation: implementation('agyw'),
        package: items('agyw.p', ['Education and social support', 'Youth-friendly health and HIV services', 'Social and economic empowerment', 'HIV prevention and risk reduction services', 'Community engagement']),
        outcome: items('agyw.o', ['HIV prevention and treatment indicators', 'Risk and prevention programmes', 'Male partner and community engagement', 'Violence and social indicators', 'Knowledge and education indicators']),
      } },
      { key: 'condom', name: 'Condom programming', items: {
        management: items('condom.m', ['State condom plan and government capacity', 'Vision for a sustainable condom market and total market approach', 'Government leadership, coordination and policies', 'Quality assurance and regulation', 'Monitoring, evaluation and data management', 'Programme financing and sustainability']),
        implementation: implementation('condom'),
        outcome: items('condom.o', ['Exposure to demand creation and behavioural interventions', 'Condom availability and use with non-regular partners', 'Condom use among men who had anal sex and sex workers', 'Condom use during paid or premarital sex', 'Condom distribution, stock-outs and outlet coverage', 'Equitable condom use across socioeconomic groups']),
      } },
      { key: 'sw', name: 'Key populations: sex workers (SW)', items: {
        management: kpManagement('sw'), implementation: kpImplementation('sw'),
        outcome: items('sw.o', ['Population size estimates and prevention strategy for SWs, including the core prevention package', 'SWs living with HIV who know their status, are on antiretroviral therapy and have suppressed viral loads', 'SWs receiving HIV prevention interventions, and condom use with most recent client', "Impact of stigma, discrimination and criminalisation on SWs' access to health care", 'SWs who avoided health care due to stigma and discrimination']),
      } },
      { key: 'msm', name: 'Key populations: men who have sex with men (MSM)', items: {
        management: kpManagement('msm'), implementation: kpImplementation('msm'),
        outcome: items('msm.o', ['MSM population size estimates and prevention strategy', 'MSM living with HIV: status knowledge, ART coverage and viral suppression', 'MSM access to HIV prevention interventions', 'Impact of stigma and discrimination on MSM healthcare access', 'Criminalisation of same-sex sexual acts and condom use']),
      } },
      { key: 'pwid', name: 'Key populations: people who inject drugs (PWID)', items: {
        management: kpManagement('pwid'), implementation: kpImplementation('pwid'),
        outcome: items('pwid.o', ['Population size estimates and prevention strategy for PWID, including the core harm reduction package', 'PWID living with HIV who know their status, are on antiretroviral therapy and have suppressed viral loads', 'PWID receiving HIV prevention interventions and safe injecting practices in the past 3 months', "Impact of stigma, discrimination and criminalisation on PWID's access to health care", 'Access to medication-assisted treatment and availability of needles and syringes']),
      } },
      { key: 'tg', name: 'Key populations: transgender people', items: {
        management: kpManagement('tg'), implementation: items('tg.i', tgItems), outcome: items('tg.o', tgItems),
      } },
      { key: 'prep', name: 'Pre-exposure prophylaxis (PrEP)', items: {
        management: items('prep.m', ['PrEP integrated into state HIV prevention with a clear rollout plan', 'National guidelines for PrEP eligibility, initiation and provider roles', 'Regulatory approval for multiple PrEP products, including generics', 'PrEP leadership and coordination led by a state focal person with multisectoral support', 'PrEP budget planning, addressing funding gaps and securing domestic financing']),
        implementation: items('prep.i', ['State PrEP work plans with clear roles, timelines and community involvement', 'Non-stigmatising risk assessment and scaling based on global tools', 'PrEP programme targets aligned with state HIV data and risk', 'Inclusive, multi-channel PrEP communication strategy', 'Reliable PrEP supply chain and procurement plan']),
        outcome: items('prep.o', ['PrEP uptake, continuation and current users tracked quarterly, disaggregated by key demographics', 'Seroconversion and drug resistance among PrEP users monitored', 'Programme effectiveness evaluated through HIV prevention impact and risk compensation']),
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
  {
    id: 'climate-response-subnational',
    name: 'Climate response (state, province or district)',
    source: "CRAFT-authored template on the same four components, drawing on the planning elements of national NDCs and National Adaptation Plans. It is not an official government scorecard; CRAFT's thresholds are used.",
    areas: [
      { key: 'adaptation', name: 'Adaptation and resilience', items: {
        management: items('adaptation.m', ['A current local adaptation plan linked to the National Adaptation Plan', 'A climate coordination body that includes communities most at risk', 'A named lead office with staff for adaptation', 'Adaptation actions included in the annual budget']),
        implementation: items('adaptation.i', ['Climate risk and vulnerability assessment done in the last five years', 'Early warning information reaches communities', 'Adaptation actions under way in priority sectors (water, agriculture, health)', 'Progress on adaptation actions monitored and reported']),
        package: items('adaptation.p', ['Climate-smart agriculture and water support', 'Disaster preparedness and response plans', 'Health services prepared for heat, floods and climate-sensitive disease', 'Support reaches women, youth and marginalised groups']),
        outcome: items('adaptation.o', ['Fewer people affected by climate disasters', 'Losses from extreme weather tracked', 'Communities report being better prepared']),
      } },
      { key: 'mitigation', name: 'Emissions reduction', items: {
        management: items('mitigation.m', ['Local targets aligned to the national NDC', 'An emissions inventory or baseline', 'Mitigation responsibilities assigned across departments']),
        implementation: items('mitigation.i', ['Clean energy or energy efficiency projects under way', 'Land use, forestry or waste actions under way', 'Emissions data collected and reported (MRV)']),
        package: items('mitigation.p', ['Access to clean energy for households and services', 'Clean cooking or transport options', 'Protection or restoration of forests and land']),
        outcome: items('mitigation.o', ['Emissions tracked against the baseline', 'Results reported against targets', 'Benefits shared fairly across communities']),
      } },
      { key: 'finance', name: 'Climate finance and accountability', items: {
        management: items('finance.m', ['Climate spending tagged in the budget', 'A plan to raise national, donor or private climate finance', 'Rules for transparent use of climate funds']),
        implementation: items('finance.i', ['Climate funds disbursed as planned', 'Spending reports published', 'Civil society and communities involved in monitoring spending']),
        outcome: items('finance.o', ['Climate finance received against need', 'Share of climate finance reaching local level', 'Independent review or audit of climate spending']),
      } },
    ],
  },
]
export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id)
export const allItemIds = (t: Template) => t.areas.flatMap((a) => componentsOf(a).flatMap((c) => a.items[c]!.map((i) => i.id)))

export function validEntry(t: Template, scores: Record<string, number>): boolean {
  const ids = new Set(allItemIds(t))
  return Object.entries(scores).every(([k, v]) => ids.has(k) && (v === 0 || v === 1 || v === 2))
}

/** One unit's result per area and component: percentage of the maximum, and its band. Unanswered items count as 0. */
export function scoreUnit(t: Template, scores: Record<string, number>) {
  return t.areas.map((a) => ({
    area: a.key, name: a.name,
    components: componentsOf(a).map((c) => {
      const list = a.items[c]!
      const got = list.reduce((s, i) => s + (scores[i.id] ?? 0), 0)
      const pct = list.length ? Math.round((got / (list.length * 2)) * 100) : 0
      return { component: c, pct, band: bandFor(pct), gaps: list.filter((i) => (scores[i.id] ?? 0) < 2).map((i) => i.text) }
    }),
  }))
}

export interface UnitResult { nodeId: string; name: string; group: string; result: ReturnType<typeof scoreUnit> }

/** NACA-style summary for one area and component: units per band overall, per group (e.g. zone), and the lists. */
export function summarise(units: UnitResult[], area: string, component: Component) {
  const pick = (u: UnitResult) => u.result.find((r) => r.area === area)?.components.find((c) => c.component === component)
  const bands: Band[] = ['immediate', 'attention', 'good']
  const groups = [...new Set(units.map((u) => u.group))].sort()
  return {
    counts: Object.fromEntries(bands.map((b) => [b, units.filter((u) => pick(u)?.band === b).length])) as Record<Band, number>,
    byGroup: groups.map((g) => ({ group: g, ...Object.fromEntries(bands.map((b) => [b, units.filter((u) => u.group === g && pick(u)?.band === b).length])) as Record<Band, number> })),
    lists: Object.fromEntries(bands.map((b) => [b, units.filter((u) => pick(u)?.band === b).map((u) => u.name).sort()])) as Record<Band, string[]>,
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
