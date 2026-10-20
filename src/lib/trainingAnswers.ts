// The validator training content is public (trainingContent.ts) but its answers are not: correct options,
// explanations, model answers, scenario outcomes and reference scores live in a private answer key, kept in the
// private craft-internal repo and in the site's private blob store. The server merges the two only when it seeds
// the training tables. Self-check: `node src/lib/trainingAnswers.test.ts`.
import type { RubricCriterion } from './validatorTraining'

export type SeedExercise =
  | { type: 'classify'; key?: string; title: string; instructions: string; items: Array<{ prompt: string; options: string[]; correct: number; explain: string }> }
  | { type: 'rung-calculator'; title: string; instructions: string; target: number; start: Record<string, number> }
  | { type: 'calibration-drill'; title: string; instructions: string }
  | { type: 'write'; title: string; instructions: string; items: Array<{ prompt: string; model: string }> }

export type SeedModule = {
  id: string; position: number; title: string; outcome: string; script: string; reflectionPrompt: string
  exercises: SeedExercise[]
  scenario: { prompt: string; choices: Array<{ text: string; consequence: string; feedback: string; best: boolean }> }
}
export type SeedQuestion = { id: string; moduleId: string | null; topic: string; prompt: string; options: string[]; correctIndex: number; explanation: string; forCheck: boolean; forExam: boolean }

export type TrainingContent = {
  modules: SeedModule[]
  questions: SeedQuestion[]
  cases: Array<{ id: string; position: number; title: string; topic: string; prompt: string; modelAnswer: string }>
  rubric: RubricCriterion[]
  capstone: { id: string; position: number; title: string; brief: string; evidence: Array<{ title: string; body: string }>; referenceScores: Record<string, number>; modelAnswer: string; rubric: RubricCriterion[] }
  calibration: Array<{ id: string; statement: string; referenceScore: number }>
  badges: Array<{ key: string; position: number; name: string; criteria: string }>
  indexModules: SeedModule[]
  indexQuestions: SeedQuestion[]
}
export type AnswerKey = { fingerprint: string; answers: unknown }

/** Fields that reveal an answer. They are removed from the public content wherever they appear. */
const ANSWER_FIELDS = new Set(['correct', 'explain', 'model', 'consequence', 'feedback', 'best', 'correctIndex', 'explanation', 'modelAnswer', 'referenceScores', 'referenceScore'])

/** Splits content into the public part and a key holding only the answer fields, in the same shape. */
export function splitAnswers(value: unknown): { open: unknown; key: unknown } {
  if (Array.isArray(value)) {
    const parts = value.map(splitAnswers)
    return { open: parts.map((p) => p.open), key: parts.some((p) => p.key !== undefined) ? parts.map((p) => p.key ?? null) : undefined }
  }
  if (value && typeof value === 'object') {
    const open: Record<string, unknown> = {}, key: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (ANSWER_FIELDS.has(k)) { key[k] = v; continue }
      const p = splitAnswers(v)
      open[k] = p.open
      if (p.key !== undefined) key[k] = p.key
    }
    return { open, key: Object.keys(key).length ? key : undefined }
  }
  return { open: value, key: undefined }
}

export function mergeAnswers(open: unknown, key: unknown): unknown {
  if (key === undefined || key === null) return open
  if (Array.isArray(open)) return open.map((v, i) => mergeAnswers(v, (key as unknown[])[i]))
  if (open && typeof open === 'object') {
    const out: Record<string, unknown> = { ...(open as Record<string, unknown>) }
    for (const [k, v] of Object.entries(key as Record<string, unknown>)) out[k] = ANSWER_FIELDS.has(k) ? v : mergeAnswers(out[k], v)
    return out
  }
  return open
}

/** FNV-1a hash of the public content, so a key is never applied to content it was not made from. */
export function fingerprint(open: unknown): string {
  let h = 0x811c9dc5
  for (const ch of JSON.stringify(open)) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}

export function withAnswers(open: unknown, key: AnswerKey): TrainingContent {
  if (key.fingerprint !== fingerprint(open)) throw new Error('The training answer key does not match this version of the training content; regenerate it in craft-internal.')
  return mergeAnswers(open, key.answers) as TrainingContent
}

/** A placeholder key for tests and local development: every answer slot is filled, none with real answers. */
export function syntheticAnswerKey(open: any): AnswerKey {
  const S = 'Placeholder (the real answer key is private)'
  const mod = (m: any) => ({
    exercises: m.exercises.map((ex: any) => ex.items ? { items: ex.items.map(() => ex.type === 'classify' ? { correct: 0, explain: S } : { model: S }) } : null),
    scenario: { choices: m.scenario.choices.map((_: unknown, i: number, all: unknown[]) => ({ consequence: S, feedback: S, best: i === all.length - 1 })) },
  })
  const q = () => ({ correctIndex: 0, explanation: S })
  return { fingerprint: fingerprint(open), answers: {
    modules: open.modules.map(mod), questions: open.questions.map(q), cases: open.cases.map(() => ({ modelAnswer: S })),
    capstone: { referenceScores: {}, modelAnswer: S }, calibration: open.calibration.map(() => ({ referenceScore: 3 })),
    indexModules: open.indexModules.map(mod), indexQuestions: open.indexQuestions.map(q),
  } }
}
