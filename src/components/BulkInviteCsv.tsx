import { useState } from 'react'
import { Download, FileUp, Loader2, Send } from 'lucide-react'
import { Button } from './ui'
import { rowsFromCsv, type BulkRow } from '../lib/bulkInvite'

// Bulk invitations from a CSV: one organisation per row. Columns (header names, any order, case-insensitive):
//   organisation (or name), email, contact (optional), type (optional: Public / Civil Society / Private, or a
//   sector such as NGO, CBO, Faith-Based, Ministry), country (optional: name or ISO code).
// Every row is checked and previewed before anything is created; then each is sent now or saved as a draft.

export function BulkInviteCsv({ submit, onDone }: {
  submit: (row: BulkRow, send: boolean) => Promise<{ ok: true } | { ok: false; error: string }>
  onDone?: () => void
}) {
  const [rows, setRows] = useState<BulkRow[] | null>(null)
  const [error, setError] = useState('')
  const [send, setSend] = useState(false)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Record<number, string>>({})

  const load = async (file: File | undefined) => {
    setError(''); setResults({}); setRows(null)
    if (!file) return
    if (file.size > 1_000_000) { setError('The file is too large (1 MB at most).'); return }
    const out = rowsFromCsv(await file.text())
    if ('error' in out) setError(out.error)
    else if (out.rows.length > 500) setError('At most 500 organisations per file.')
    else setRows(out.rows)
  }
  const good = rows?.filter((r) => !r.problem) ?? []
  const run = async () => {
    if (!rows) return
    setBusy(true)
    const res: Record<number, string> = {}
    for (const [i, r] of rows.entries()) {
      if (r.problem) continue
      const out = await submit(r, send)
      res[i] = out.ok ? (send ? 'Sent' : 'Draft saved') : out.error
      setResults({ ...res })
    }
    setBusy(false)
    onDone?.()
  }
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/30 p-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileUp className="h-4 w-4 text-emerald-700" /> Invite organisations from a CSV file</p>
        <p className="text-xs text-slate-600">Columns: <code>organisation</code>, <code>email</code>, and optionally <code>contact</code>, <code>type</code> (Public, Civil Society, Private, or e.g. NGO, CBO, Faith-Based) and <code>country</code>. Nothing is sent until you confirm.</p>
      </div>
      <p className="text-xs">
        <a href="/templates/craft-organisation-invitations-sample.csv" download="craft-organisation-invitations-sample.csv" className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline">
          <Download className="h-3.5 w-3.5" /> Download the sample CSV
        </a>{' '}
        <span className="text-slate-500">with the right columns and example rows: replace the examples with your organisations, save as CSV, then upload.</span>
      </p>
      <input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => void load(e.target.files?.[0])} className="text-sm" />
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {rows && (
        <>
          <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="p-2">Organisation</th><th className="p-2">Email</th><th className="p-2">Type</th><th className="p-2">Country</th><th className="p-2">Status</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="p-2">{r.orgName}</td><td className="p-2">{r.email}</td>
                    <td className="p-2">{[r.orgArchetype, r.orgSector].filter(Boolean).join(' · ')}</td><td className="p-2">{r.orgCountry}</td>
                    <td className={`p-2 ${r.problem ? 'text-rose-700' : results[i] && !['Sent', 'Draft saved'].includes(results[i]) ? 'text-rose-700' : 'text-emerald-700'}`}>{r.problem ?? results[i] ?? 'Ready'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="bulk-when" checked={!send} onChange={() => setSend(false)} className="accent-emerald-600" /> Save as drafts, send later</label>
            <label className="flex items-center gap-2"><input type="radio" name="bulk-when" checked={send} onChange={() => setSend(true)} className="accent-emerald-600" /> Send now</label>
            <Button size="sm" disabled={busy || !good.length || Object.keys(results).length > 0} onClick={() => void run()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {send ? `Send ${good.length}` : `Save ${good.length} draft${good.length === 1 ? '' : 's'}`}
            </Button>
            {rows.length > good.length && <span className="text-xs text-rose-700">{rows.length - good.length} row{rows.length - good.length === 1 ? '' : 's'} with problems will be skipped.</span>}
          </div>
        </>
      )}
    </div>
  )
}
