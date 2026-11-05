// Evidence-gated scoring for core bank questions that carry level statements (levels 1–5). A level is reached only
// when every statement in it, and in every level below, is met with evidence that was seen; otherwise the score is the
// last level fully evidenced (0 when level 1 is not). Questions without statements keep the 0–5 slider.
// Self-check: `node src/lib/evidenceGate.test.ts`.

export type QuestionLevels = Partial<Record<1 | 2 | 3 | 4 | 5, string[]>>
export type StatementResponse = { met: boolean; evidence: string }
export type StatementResponses = Record<string, StatementResponse>

export const GATE_LEVELS = [1, 2, 3, 4, 5] as const
export const statementId = (qId: string, level: number, i: number) => `${qId}.L${level}.${i + 1}`
const evidenced = (r: StatementResponse | undefined) => !!r?.met && r.evidence.trim().length > 0

/** The 0–5 score the evidence supports. */
export function gatedScore(qId: string, levels: QuestionLevels, responses: StatementResponses): number {
  let score = 0
  for (const l of GATE_LEVELS) {
    const st = levels[l] ?? []
    if (!st.length || !st.every((_, i) => evidenced(responses[statementId(qId, l, i)]))) break
    score = l
  }
  return score
}

/** Whether a question uses evidence-gated scoring: every level 1–5 has at least one statement. */
export const isGated = (levels: QuestionLevels | undefined): levels is QuestionLevels => !!levels && GATE_LEVELS.every((l) => (levels[l]?.length ?? 0) > 0)
