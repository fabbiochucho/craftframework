import { INDICATOR_CATALOGUE } from '../crosswalkExisting.ts'
import { CONTINENTAL_JURISDICTIONS, LAW_AREAS, LAW_JURISDICTIONS, type LawEntry } from './types.ts'

const KNOWN_QUESTIONS = new Set(INDICATOR_CATALOGUE.map((e) => e.id))
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s

/** Everything wrong with a set of entries; empty when all are valid. `today` is YYYY-MM-DD. */
export function registerProblems(entries: LawEntry[], today: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    const p = (m: string) => out.push(`${e.id}: ${m}`)
    if (seen.has(e.id)) p('duplicate id')
    seen.add(e.id)
    if (!LAW_JURISDICTIONS.includes(e.jurisdiction) && !CONTINENTAL_JURISDICTIONS.includes(e.jurisdiction)) p(`unknown jurisdiction "${e.jurisdiction}"`)
    if (!(e.area in LAW_AREAS)) p(`unknown area "${e.area}"`)
    for (const k of ['title', 'citation', 'summary'] as const) if (!e[k]?.trim()) p(`missing ${k}`)
    if (e.summary.trim().split(/\s+/).length > 60) p('summary over 60 words')
    if (!e.source.url.startsWith('https://')) p('source must be https')
    if (!validDate(e.source.checked)) p('checked is not a valid date')
    else if (e.source.checked > today) p('checked date is in the future')
    for (const q of e.extraQuestions ?? []) if (!KNOWN_QUESTIONS.has(q)) p(`unknown question "${q}"`)
  }
  return out
}
