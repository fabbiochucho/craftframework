// What kind of support a grant or award gives (separate from the funding model, which is how money is paid).
// One award can be several kinds. Shared by the awards and funder-programme APIs and their screens.
export const SUPPORT_TYPES = [
  { id: 'project_grant', label: 'Project grant', blurb: 'Cash for a defined project' },
  { id: 'core_funding', label: 'Core or institutional funding', blurb: 'Cash for the organisation as a whole' },
  { id: 'technical_assistance', label: 'Technical assistance', blurb: 'Experts or advisers provided, no cash' },
  { id: 'capacity_strengthening', label: 'Capacity strengthening', blurb: 'Training, mentoring, organisational development' },
  { id: 'in_kind', label: 'In-kind support', blurb: 'Goods, equipment or commodities' },
  { id: 'sub_grant', label: 'Sub-grant or pass-through', blurb: 'Funds the organisation passes on to others' },
  { id: 'emergency', label: 'Emergency or rapid response', blurb: 'Short-term funding for a crisis' },
] as const

export type SupportType = (typeof SUPPORT_TYPES)[number]['id']
export const SUPPORT_TYPE_IDS = SUPPORT_TYPES.map((t) => t.id) as [SupportType, ...SupportType[]]
export const supportLabel = (id: string) => SUPPORT_TYPES.find((t) => t.id === id)?.label ?? id
/** Known ids only, each once, in the list's order. */
export const cleanSupportTypes = (v: unknown): SupportType[] =>
  Array.isArray(v) ? SUPPORT_TYPE_IDS.filter((id) => v.includes(id)) : []
