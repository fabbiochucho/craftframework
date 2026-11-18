// The offline Excel workbook: built for one organisation, filled in without a connection, uploaded back.
// Pure helpers (no Excel library here) so the reading rules are tested: `node src/lib/offlineWorkbook.test.ts`.

export type WorkbookMode = 'own' | 'independent'
export const WORKBOOK_VERSION = '1'
export const SHEETS = { start: 'Start here', onc: 'CRAFT-ONC', wizard: '5-tier assessment', meta: '_craft' } as const
export const COLS = { code: 'Code', score: 'Score (0-5)', notes: 'Notes and evidence' } as const

export type ReadRow = { sheet: string; row: number; code: unknown; score: unknown; notes: unknown }
export type Parsed = { scores: Record<string, number>; notes: Record<string, string>; problems: string[] }

/** Turn the rows read from the answer sheets into scores and notes; every problem names its sheet and row. */
export function readAnswers(rows: ReadRow[], knownCodes: Set<string>): Parsed {
  const out: Parsed = { scores: {}, notes: {}, problems: [] }
  for (const r of rows) {
    const code = String(r.code ?? '').trim()
    if (!code) continue
    const where = `${r.sheet}, row ${r.row} (${code})`
    if (!knownCodes.has(code)) { out.problems.push(`${where}: not a question in this workbook`); continue }
    const raw = r.score == null ? '' : String(r.score).trim()
    if (raw !== '') {
      const n = Number(raw)
      if (!Number.isInteger(n) || n < 0 || n > 5) out.problems.push(`${where}: the score must be a whole number from 0 to 5, not "${raw.slice(0, 20)}"`)
      else out.scores[code] = n
    }
    const note = r.notes == null ? '' : String(r.notes).trim()
    if (note.length > 2000) out.problems.push(`${where}: the note is longer than 2,000 characters`)
    else if (note) out.notes[code] = note
  }
  return out
}
