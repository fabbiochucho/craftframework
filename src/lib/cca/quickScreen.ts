// CRAFT quick pre-award screen: a short yes/no and banded questionnaire that sorts an applicant into one of four
// outcomes before (or instead of) the full Pre-Award capacity assessment. The questions are private content (blob
// store `cca-private`, key `screen`, built in craft-internal); the scoring rules live here.
// Self-check: `node src/lib/cca/quickScreen.test.ts`.
//
// Scoring: every yes/no question is worth 1 point for "yes"; a banded question is worth the points of the option
// chosen. Unanswered counts as 0. The result is the share of the maximum, read as an outcome (half-open bands):
//   85% and above  Eligible, with minimal support
//   55% to <85%    Eligible, with substantial support
//   35% to <55%    High risk to award
//   below 35%      Not eligible
// Answers are self-reported: a borderline result points to the full, evidence-gated Pre-Award module.

export type ScreenOption = { value: string; label: string; points: number }
export type ScreenQuestion = { id: string; text: string } & ({ kind: 'yes_no' } | { kind: 'choice'; options: ScreenOption[] })
export type ScreenSection = { id: string; name: string; questions: ScreenQuestion[] }
export type QuickScreen = { name: string; sections: ScreenSection[] }
/** Question id -> 'yes' | 'no' | the chosen option's value. */
export type ScreenAnswers = Record<string, string>

export const OUTCOMES = ['minimal_support', 'substantial_support', 'high_risk', 'not_eligible'] as const
export type Outcome = (typeof OUTCOMES)[number]
export const OUTCOME_LABEL: Record<Outcome, string> = {
  minimal_support: 'Eligible, with minimal support',
  substantial_support: 'Eligible, with substantial support',
  high_risk: 'High risk to award',
  not_eligible: 'Not eligible',
}
export const OUTCOME_NEXT: Record<Outcome, string> = {
  minimal_support: 'Proceed. Confirm the critical areas with evidence in the Pre-Award assessment for large or high-risk awards.',
  substantial_support: 'Run the full Pre-Award assessment and agree a capacity support plan and special conditions before signing.',
  high_risk: 'Run the full Pre-Award assessment. Award only with strong special conditions, close monitoring and support.',
  not_eligible: 'Do not award now. Share the gaps and invite a new application once they are addressed.',
}

export function outcomeFor(ratio: number): Outcome {
  if (ratio >= 0.85) return 'minimal_support'
  if (ratio >= 0.55) return 'substantial_support'
  if (ratio >= 0.35) return 'high_risk'
  return 'not_eligible'
}

const maxPoints = (q: ScreenQuestion) => (q.kind === 'yes_no' ? 1 : Math.max(...q.options.map((o) => o.points)))
const points = (q: ScreenQuestion, a: string | undefined) =>
  q.kind === 'yes_no' ? (a === 'yes' ? 1 : 0) : (q.options.find((o) => o.value === a)?.points ?? 0)

/** Is this a valid answer to the question? */
export const validAnswer = (q: ScreenQuestion, a: string) => (q.kind === 'yes_no' ? a === 'yes' || a === 'no' : q.options.some((o) => o.value === a))

export type ScreenResult = {
  sections: { id: string; name: string; score: number; max: number; percent: number; gaps: string[] }[]
  score: number; max: number; percent: number; outcome: Outcome; unanswered: number
}

/** Score the answers: by section (with the questions not scoring full points as gaps) and overall. */
export function scoreScreen(s: QuickScreen, answers: ScreenAnswers): ScreenResult {
  const sections = s.sections.map((sec) => {
    const score = sec.questions.reduce((t, q) => t + points(q, answers[q.id]), 0)
    const max = sec.questions.reduce((t, q) => t + maxPoints(q), 0)
    const gaps = sec.questions.filter((q) => points(q, answers[q.id]) < maxPoints(q)).map((q) => q.text)
    return { id: sec.id, name: sec.name, score, max, percent: max ? Math.round((score / max) * 100) : 0, gaps }
  })
  const score = sections.reduce((t, x) => t + x.score, 0)
  const max = sections.reduce((t, x) => t + x.max, 0)
  const unanswered = s.sections.flatMap((x) => x.questions).filter((q) => !answers[q.id]).length
  return { sections, score, max, percent: max ? Math.round((score / max) * 100) : 0, outcome: outcomeFor(max ? score / max : 0), unanswered }
}

/** Problems with screen content (empty = valid): sections and questions present, unique ids, options with points. */
export function screenProblems(s: unknown): string[] {
  const out: string[] = []
  const x = s as QuickScreen
  if (!x || !Array.isArray(x.sections) || !x.sections.length) return ['the screen needs sections']
  const ids = new Set<string>()
  const unique = (id: string, what: string) => { if (!id || ids.has(id)) out.push(`${what} ${id || '(no id)'}: ids must be present and unique`); ids.add(id) }
  for (const sec of x.sections) {
    unique(sec.id, 'section')
    if (!sec.name?.trim() || !Array.isArray(sec.questions) || !sec.questions.length) { out.push(`${sec.id}: needs a name and questions`); continue }
    for (const q of sec.questions) {
      unique(q.id, 'question')
      if (!q.text?.trim()) out.push(`${q.id}: needs text`)
      if (q.kind === 'choice') {
        if (!Array.isArray(q.options) || q.options.length < 2) { out.push(`${q.id}: a choice needs at least two options`); continue }
        if (new Set(q.options.map((o) => o.value)).size !== q.options.length) out.push(`${q.id}: option values must be unique`)
        if (q.options.some((o) => !(o.points >= 0) || o.value === 'yes' || o.value === 'no' || !o.label?.trim())) out.push(`${q.id}: options need a label and points of 0 or more`)
      } else if ((q as { kind: string }).kind !== 'yes_no') out.push(`${q.id}: unknown kind`)
    }
  }
  return out
}
