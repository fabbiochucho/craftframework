// CRAFT Capacity Assessment modules. Only the catalogue (names and who each is for) is public; the capacity areas,
// domains and statements are private content (blob store `cca-private`, key `modules`, built in craft-internal) and
// are served to signed-in users by /api/cca/modules. Self-check: `node src/lib/cca/modules.test.ts`.
import type { CcaModule } from './engine.ts'

export const CCA_MODULES = [
  { id: 'national', name: 'National', audience: 'National government institutions and national CSO networks', stage: 'capacity' },
  { id: 'state', name: 'State', audience: 'State government institutions and state CSO networks', stage: 'capacity' },
  { id: 'local', name: 'Local Government', audience: 'Local government departments and affiliated units', stage: 'capacity' },
  { id: 'community', name: 'Community', audience: 'Civil society, community-based and faith-based organisations', stage: 'capacity' },
  { id: 'pre_award', name: 'Pre-Award', audience: 'Organisations before a grant or contract is signed', stage: 'award' },
  { id: 'during_award', name: 'During-Award', audience: 'Organisations managing a current grant or contract', stage: 'award' },
  { id: 'post_award', name: 'Post-Award', audience: 'Organisations at and after close-out of a grant or contract', stage: 'award' },
] as const
export type CcaModuleId = (typeof CCA_MODULES)[number]['id']
export const CCA_MODULE_IDS = CCA_MODULES.map((m) => m.id) as CcaModuleId[]
export const isAwardModule = (id: string) => CCA_MODULES.some((m) => m.id === id && m.stage === 'award')

/** Problems with module content (empty = valid): known ids, 3–5 domains per area, statements at levels 2–4, unique ids. */
export function contentProblems(modules: unknown): string[] {
  const out: string[] = []
  if (!Array.isArray(modules)) return ['content must be a list of modules']
  const seen = new Set<string>()
  const unique = (id: unknown, where: string) => {
    if (typeof id !== 'string' || !id) out.push(`${where}: missing id`)
    else if (seen.has(id)) out.push(`${where}: duplicate id ${id}`)
    else seen.add(id)
  }
  for (const m of modules as CcaModule[]) {
    if (!CCA_MODULE_IDS.includes(m?.id as CcaModuleId)) { out.push(`unknown module ${String(m?.id)}`); continue }
    if (!Array.isArray(m.areas) || !m.areas.length) out.push(`${m.id}: no capacity areas`)
    for (const a of m.areas ?? []) {
      unique(`${m.id}/${a.id}`, `${m.id} area`)
      if (!Array.isArray(a.domains) || a.domains.length < 3 || a.domains.length > 5) out.push(`${m.id}/${a.id}: needs 3 to 5 domains`)
      for (const d of a.domains ?? []) {
        unique(d.id, `${m.id}/${a.id} domain`)
        if (!d.name?.trim() || !d.level1?.trim()) out.push(`${d.id}: needs a name and a level 1 description`)
        for (const l of [2, 3, 4] as const) {
          const st = d.levels?.[l]
          if (!Array.isArray(st) || !st.length) { out.push(`${d.id}: level ${l} needs statements`); continue }
          for (const s of st) {
            unique(s.id, `${d.id} level ${l} statement`)
            if (!s.text?.trim()) out.push(`${s.id}: empty statement`)
          }
        }
      }
    }
  }
  return out
}
