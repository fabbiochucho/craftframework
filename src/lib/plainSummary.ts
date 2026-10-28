// "In plain words": a short summary of one assessment's results for non-technical people, boards and teams. Written
// from the organisation's own scores: where it stands, its top gaps and the first steps. Pure; no React.
// Self-check: `node src/lib/plainSummary.test.ts`.
import { computeOrgScore, getReadinessClassification, type Question } from './data.ts'
import { LADDER_INDICATORS, LADDER_LEVELS, currentRung } from './capitalReadiness.ts'
import { ESG_QUESTIONS } from './esg.ts'
import type { IndexReport } from './reports/indexReport.ts'

export interface PlainSummary {
  title: string
  /** One or two sentences: where the organisation stands. */
  standing: string
  gaps: { text: string; area: string }[]
  steps: string[]
}

const TOP = 3
const lowest = <T extends { score: number }>(xs: T[]) => [...xs].sort((a, b) => a.score - b.score).slice(0, TOP)
const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))].slice(0, TOP)

/** Core assessment (dashboard), from the loaded question bank (the full text is private and loaded at runtime). */
export function coreSummary(questions: Question[], scores: Record<string, number>): PlainSummary | null {
  const answered = questions.filter((q) => scores[q.id] != null).map((q) => ({ q, score: scores[q.id] }))
  if (!answered.length) return null
  const composite = computeOrgScore(scores)
  const weak = lowest(answered.filter((a) => a.score <= 2))
  return {
    title: 'Core assessment',
    standing: `Your overall score is ${composite} out of 100: "${getReadinessClassification(composite).label}". This is based on the ${answered.length} questions you have answered so far.`,
    gaps: weak.map((a) => ({ text: a.q.question, area: a.q.domain })),
    steps: weak.length ? unique(weak.map((a) => a.q.capacityAction)) : ['No answer is scored 2 or below. Keep your evidence up to date and finish any areas you have not answered.'],
  }
}

/** Capital Readiness Ladder. Null until something is answered. */
export function ladderSummary(scores: Record<string, number>): PlainSummary | null {
  if (!LADDER_INDICATORS.some((i) => scores[i.id] != null)) return null
  const rung = currentRung(scores)
  const next = LADDER_LEVELS.find((l) => l.level === rung + 1)
  const reached = LADDER_LEVELS.find((l) => l.level === rung)
  if (!next) {
    return { title: 'Capital Readiness Ladder', standing: 'You have reached the top rung, Capital Market Readiness. Keep the evidence current so a validator can confirm it.', gaps: [], steps: ['Ask an accredited validator to confirm your rung.'] }
  }
  const inNext = LADDER_INDICATORS.filter((i) => i.level === next.level)
  const blank = inNext.filter((i) => scores[i.id] == null)
  const weak = lowest(inNext.filter((i) => scores[i.id] != null && scores[i.id] < 4).map((i) => ({ i, score: scores[i.id] })))
  const where = reached ? `You are on rung ${rung} of 7, ${reached.name}.` : 'You have not reached the first rung, Survival, yet.'
  return {
    title: 'Capital Readiness Ladder',
    standing: `${where} The next rung is ${next.name}: "${next.question}"${blank.length ? ` ${blank.length} of its questions ${blank.length === 1 ? 'is' : 'are'} still unanswered.` : ''}`,
    gaps: weak.map(({ i }) => ({ text: i.question, area: i.domain })),
    steps: unique([...(blank.length ? [`Answer the ${blank.length} remaining ${next.name} question${blank.length === 1 ? '' : 's'}.`] : []), ...weak.map(({ i }) => i.recommendation)]),
  }
}

/** ESG self-assessment. Null until something is answered. */
export function esgSummary(scores: Record<string, number>): PlainSummary | null {
  const answered = ESG_QUESTIONS.filter((q) => scores[q.id] != null).map((q) => ({ q, score: scores[q.id] }))
  if (!answered.length) return null
  const pillars = (['Environmental', 'Social', 'Governance'] as const).map((p) => {
    const xs = answered.filter((a) => a.q.pillar === p)
    return { p, avg: xs.length ? xs.reduce((s, a) => s + a.score, 0) / xs.length : null }
  }).filter((x) => x.avg !== null) as { p: string; avg: number }[]
  const weakest = [...pillars].sort((a, b) => a.avg - b.avg)[0]
  const weak = lowest(answered.filter((a) => a.score < 3))
  return {
    title: 'ESG self-assessment',
    standing: `${pillars.map((x) => `${x.p} ${x.avg.toFixed(1)}`).join(', ')} out of 5, from your own answers. ${weakest ? `${weakest.p} is your weakest area.` : ''}`.trim(),
    gaps: weak.map((a) => ({ text: a.q.question, area: a.q.pillar })),
    steps: weak.length ? unique(weak.map((a) => a.q.recommendation)) : ['No answer is below 3. Add evidence for your answers so they can be relied on.'],
  }
}

/** One CRAFT index, from its index report. Null until something is answered. */
export function indexSummary(r: IndexReport): PlainSummary | null {
  if (!r.answered) return null
  const band = r.band?.band.label
  return {
    title: r.title,
    standing: `${band ? `Your band is ${band}` : 'Your band is not set yet'}${r.band?.provisional ? ', provisional until every question is answered' : ''}. You have answered ${r.answered} of ${r.total} questions.`,
    gaps: r.weakest.slice(0, TOP).map((w) => ({ text: w.question, area: r.title })),
    steps: r.actions.length ? unique(r.actions.map((a) => a.mitigation)) : ['Start with the lowest-scored questions above, and add evidence for your answers.'],
  }
}
