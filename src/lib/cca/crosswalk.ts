// Growth levels next to other CRAFT results. The evidenced level comes from a completed Capacity Assessment; without
// one, CRAFT's 0–5 scores are converted onto the 1–4 scale as an indicative level (clearly labelled as such).
// Self-check: `node src/lib/cca/crosswalk.test.ts`.
import { dashboard, effectiveNotAssessed, growthLevel, type CcaModule, type GrowthLevel, type NotAssessed, type Responses } from './engine.ts'
import { isAwardModule } from './modules.ts'

/** CRAFT composite (0–100%, i.e. an average of 0–5 scores) → 1–4 → growth level. Linear: 0% → 1.00, 100% → 4.00. */
export function indicativeLevel(compositePct: number): { score: number; level: GrowthLevel } {
  const pct = Math.min(100, Math.max(0, compositePct))
  const score = Math.round((1 + (pct / 100) * 3) * 100) / 100
  return { score, level: growthLevel(score) }
}

type Assessment = { module: string; year: number; status: string; responses: Responses; notAssessed?: NotAssessed; domainIds?: string[] | null; completedAt: string | null }

/** The latest completed capacity assessment (not a grant-stage one), scored by the engine. */
export function evidencedLevel(assessments: Assessment[], modules: CcaModule[]): { module: string; year: number; score: number; level: GrowthLevel } | null {
  const done = assessments.filter((a) => a.status === 'complete' && !isAwardModule(a.module) && modules.some((m) => m.id === a.module))
    .sort((a, b) => b.year - a.year || (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  const a = done[0]
  if (!a) return null
  const m = modules.find((x) => x.id === a.module)!
  const d = dashboard(m, a.responses, effectiveNotAssessed(m, a.notAssessed, a.domainIds))
  return { module: a.module, year: a.year, score: d.average, level: d.level }
}
