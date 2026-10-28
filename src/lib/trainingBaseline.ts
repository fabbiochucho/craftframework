// Pre- and post-tests for the explainer training videos: a learner answers the module's three pre-test questions
// before the video and the same three plus two more afterwards, which gives a baseline and a measure of learning.
// Practice questions only, separate from the certification exam; they never count towards accreditation.
// The bank (questions with answers) is not in the public repo: it lives in craft-internal/training and the site's
// private blob store, and is passed in here. Scored on the server. Self-check: `node src/lib/trainingBaseline.test.ts`.

export type BaselineKind = 'pre' | 'post'
export interface BaselineQuestion { id: string; prompt: string; options: string[]; correct: number; explanation: string }
export type BaselineBank = Record<string, { pre: BaselineQuestion[]; postExtra: BaselineQuestion[] }>
export interface AttemptRow { email: string; moduleId: string; kind: BaselineKind; score: number; total: number; createdAt: Date }

function questionsFor(bank: BaselineBank, moduleId: string, kind: BaselineKind): BaselineQuestion[] | null {
  const m = Object.hasOwn(bank, moduleId) ? bank[moduleId] : undefined
  if (!m) return null
  return kind === 'pre' ? m.pre : [...m.pre, ...m.postExtra]
}

/** The questions to show before answering: no answers, no explanations. */
export function askQuestions(bank: BaselineBank, moduleId: string, kind: BaselineKind) {
  return questionsFor(bank, moduleId, kind)?.map(({ id, prompt, options }) => ({ id, prompt, options })) ?? null
}

/** Scores one attempt; null when the module is unknown or the answers do not fit the questions. */
export function scoreAttempt(bank: BaselineBank, moduleId: string, kind: BaselineKind, answers: unknown[]) {
  const qs = questionsFor(bank, moduleId, kind)
  if (!qs || answers.length !== qs.length) return null
  if (!answers.every((a, i) => Number.isInteger(a) && (a as number) >= 0 && (a as number) < qs[i].options.length)) return null
  const results = qs.map((q, i) => ({ id: q.id, chosen: answers[i] as number, correct: q.correct, ok: answers[i] === q.correct, explanation: q.explanation }))
  return { score: results.filter((r) => r.ok).length, total: qs.length, results }
}

type Result = { score: number; total: number; at: Date }
const firstPre = (rows: AttemptRow[]) => rows.filter((r) => r.kind === 'pre').sort((a, b) => +a.createdAt - +b.createdAt)[0]
const latestPost = (rows: AttemptRow[]) => rows.filter((r) => r.kind === 'post').sort((a, b) => +b.createdAt - +a.createdAt)[0]
const asResult = (r?: AttemptRow): Result | undefined => (r ? { score: r.score, total: r.total, at: r.createdAt } : undefined)

/** One learner's results per module: the first pre-test is the baseline, the latest post-test the outcome. */
export function learnerView(modules: string[], rows: AttemptRow[]): Record<string, { pre?: Result; post?: Result }> {
  return Object.fromEntries(modules.map((m) => {
    const mine = rows.filter((r) => r.moduleId === m)
    return [m, { pre: asResult(firstPre(mine)), post: asResult(latestPost(mine)) }]
  }))
}

const pct = (r: AttemptRow) => r.score / r.total
const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) : null)

/** Programme team view: per module, mean % correct before and after, and the mean change for learners with both. */
export function summarise(modules: string[], rows: AttemptRow[]) {
  return modules.map((moduleId) => {
    const byLearner = new Map<string, AttemptRow[]>()
    for (const r of rows) if (r.moduleId === moduleId) byLearner.set(r.email, [...(byLearner.get(r.email) ?? []), r])
    const pres = [...byLearner.values()].map(firstPre).filter(Boolean) as AttemptRow[]
    const posts = [...byLearner.values()].map(latestPost).filter(Boolean) as AttemptRow[]
    const paired = [...byLearner.values()].flatMap((rs) => {
      const p = firstPre(rs), q = latestPost(rs)
      return p && q ? [pct(q) - pct(p)] : []
    })
    return {
      moduleId,
      pre: { n: pres.length, meanPct: mean(pres.map(pct)) },
      post: { n: posts.length, meanPct: mean(posts.map(pct)) },
      paired: { n: paired.length, changePct: mean(paired) },
    }
  })
}
