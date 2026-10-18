// The five-stage ESG maturity journey, placed from answers and confirmed by evidence. Stage names and descriptions are
// CRAFT's own; the idea of a staged journey draws on published sustainability maturity models (see the spec).
// Self-check: `node src/lib/esgMaturity.test.ts`.
import { ESG_QUESTIONS, pillarEvidenceScore, RATED_QUESTION_IDS, type EsgPillar, type EsgQuestion } from './esg.ts'

export interface EsgStage { n: 1 | 2 | 3 | 4 | 5; name: string; summary: string; criteria: string[] }
export const ESG_STAGES: EsgStage[] = [
  { n: 1, name: 'Foundations', summary: 'Policies, legal permits, fair labour, ethics and board oversight in place; material issues identified.', criteria: ['ESG-E3', 'ESG-S1', 'ESG-G1', 'ESG-G2', 'ESG-G5'] },
  { n: 2, name: 'Efficiency', summary: 'Emissions, energy, water and waste measured and managed, with reduction targets; safe workplaces.', criteria: ['ESG-E1', 'ESG-E2', 'ESG-E5', 'ESG-S2'] },
  { n: 3, name: 'Resilience', summary: 'Climate and nature risks assessed, risk management formalised, affected communities engaged.', criteria: ['ESG-E4', 'ESG-N1', 'ESG-N2', 'ESG-G3', 'ESG-S4'] },
  { n: 4, name: 'Integrated value', summary: 'Sustainability built into strategy, budget and board oversight, with regular disclosure and nature and climate targets.', criteria: ['ESG-G4', 'ESG-G6', 'ESG-N3', 'ESG-S3'] },
  { n: 5, name: 'Systemic leadership', summary: 'Working with the value chain on emissions and nature, and contributing to sector or SDG-level change.', criteria: ['ESG-V1', 'ESG-V2'] },
]
/** "Partial" on the 0–4 evidence scale, as scaled to 0–5 by `pillarEvidenceScore`. */
export const EVIDENCE_CONFIRM_THRESHOLD = 2.5

export interface EsgMaturity {
  /** 0 = not yet at Foundations. */
  stage: 0 | 1 | 2 | 3 | 4 | 5
  /** False when the stage is 3 or more and a pillar it relies on has evidence below Partial. */
  confirmed: boolean
  /** True when some criterion up to the current stage is still unanswered. */
  provisional: boolean
  /** Unanswered criteria up to the current stage. */
  toConfirm: number
  next: EsgStage | null
  /** Unmet criteria (answered below 3, or unanswered) up to and including the next stage. */
  missing: EsgQuestion[]
  /** Unanswered criteria across all stages. */
  unanswered: number
}

const byId = new Map(ESG_QUESTIONS.map((q) => [q.id, q]))
const met = (scores: Record<string, number>, id: string) => (scores[id] ?? -1) >= 3

/**
 * A stage is reached when it and every stage below it have at least one answered criterion and no answered criterion
 * below 3. Unanswered criteria don't block (the stage is then provisional), so new questions never demote anyone.
 */
export function esgMaturity(scores: Record<string, number>, evidence: Record<string, number>): EsgMaturity {
  let stage = 0
  for (const s of ESG_STAGES) {
    const answered = s.criteria.filter((id) => id in scores)
    if (answered.length === 0 || answered.some((id) => scores[id] < 3)) break
    stage = s.n
  }
  const reached = ESG_STAGES.filter((s) => s.n <= stage).flatMap((s) => s.criteria)
  const next = ESG_STAGES.find((s) => s.n === stage + 1) ?? null
  const missing = ESG_STAGES.filter((s) => s.n <= (next?.n ?? 0)).flatMap((s) => s.criteria).filter((id) => !met(scores, id)).map((id) => byId.get(id)!)
  const toConfirm = reached.filter((id) => !(id in scores)).length
  const pillars = new Set<EsgPillar>(reached.map((id) => byId.get(id)!.pillar))
  return {
    stage: stage as EsgMaturity['stage'],
    confirmed: stage < 3 || [...pillars].every((p) => pillarEvidenceScore(p, evidence) >= EVIDENCE_CONFIRM_THRESHOLD),
    provisional: toConfirm > 0,
    toConfirm,
    next,
    missing,
    unanswered: ESG_STAGES.flatMap((s) => s.criteria).filter((id) => !(id in scores)).length,
  }
}

/** One line for cards and reports, e.g. "Stage 2: Efficiency (provisional — answer 3 remaining questions to confirm)". */
export function stageLabel(m: EsgMaturity): string {
  const s = ESG_STAGES.find((x) => x.n === m.stage)
  if (!s) return 'Not yet at Foundations'
  const notes = [
    m.provisional ? `provisional — answer ${m.toConfirm} remaining question${m.toConfirm === 1 ? '' : 's'} to confirm` : '',
    m.confirmed ? '' : 'self-reported — add evidence to confirm',
  ].filter(Boolean)
  return `Stage ${s.n}: ${s.name}${notes.length ? ` (${notes.join('; ')})` : ''}`
}

/** The eight questions added in October 2026 (maturity, nature, value chain). */
export const NEW_ESG_IDS = ['ESG-G5', 'ESG-E5', 'ESG-N1', 'ESG-N2', 'ESG-N3', 'ESG-G6', 'ESG-V1', 'ESG-V2']
/** Show the "new questions added" notice only to organisations that answered the original assessment and still have new ones open. */
export const shouldShowNewQuestionsNotice = (scores: Record<string, number>): boolean =>
  RATED_QUESTION_IDS.some((id) => id in scores) && NEW_ESG_IDS.some((id) => !(id in scores))
