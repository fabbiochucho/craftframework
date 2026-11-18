// Offline Excel workbook: download a CRAFT-branded workbook for this organisation, fill it in without a connection,
// upload it back. The organisation (or anyone with write access to it, such as a funder it has given that access)
// fills its own answers; its independent assessor (or the Super Admin) fills independent scores. The server checks
// who may save what (/api/responses PUT); nothing is saved until every row is valid.
import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { Button } from './ui'
import { useAuthCtx, useScoresCtx, useWorkspace } from '../lib/context'
import type { Question } from '../lib/data'
import { CRAFT_ONC } from '../lib/indices/craftOnc'
import { COLS, readAnswers, SHEETS, WORKBOOK_VERSION, type ReadRow, type WorkbookMode } from '../lib/offlineWorkbook'

// The library is only loaded when someone downloads or uploads a workbook (it is large).
// ponytail: browser build of exceljs; move generation to the server if workbooks must be emailed automatically.
const excel = async () => (await import('exceljs/dist/exceljs.min.js')).default

const GREEN = 'FF064E3B', LIGHT = 'FFECFDF5', INPUT = 'FFFFFBEB', GREY = 'FFF1F5F9'

export function OfflineWorkbook({ questions }: { questions: Question[] }) {
  const { currentUser } = useAuthCtx()
  const { currentOrg } = useWorkspace()
  const { scores, assessorScores, refreshScores } = useScoresCtx()
  const orgId = currentOrg?.id ?? currentUser?.orgId ?? ''
  const orgName = currentOrg?.name ?? currentUser?.orgName ?? ''
  const isIndependent = currentUser?.role === 'independent'
  const modes: WorkbookMode[] = isIndependent ? ['independent'] : currentUser?.role === 'super_admin' ? ['own', 'independent'] : ['own']
  const [mode, setMode] = useState<WorkbookMode>(modes[0])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ ok?: string; problems?: string[] } | null>(null)
  const [pending, setPending] = useState<{ mode: WorkbookMode; scores: Record<string, number>; notes: Record<string, string> } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  if (!currentUser || currentUser.isDemo || !orgId) return null

  const label = (m: WorkbookMode) => (m === 'own' ? `${orgName}'s own answers` : 'Independent assessor scores')

  const download = async () => {
    setBusy('Preparing the workbook…'); setMsg(null)
    try {
      const ExcelJS = await excel()
      const wb = new ExcelJS.Workbook()
      wb.creator = 'CRAFT (DiBadili Institute)'
      const filled = (mode === 'own' ? scores[orgId] : assessorScores[orgId]) ?? {}

      const start = wb.addWorksheet(SHEETS.start, { properties: { tabColor: { argb: GREEN } } })
      start.columns = [{ width: 4 }, { width: 110 }]
      const line = (text: string, opts: { size?: number; bold?: boolean; fill?: string; color?: string } = {}) => {
        const row = start.addRow(['', text])
        const c = row.getCell(2)
        c.font = { name: 'Calibri', size: opts.size ?? 11, bold: opts.bold, color: { argb: opts.color ?? 'FF0F172A' } }
        c.alignment = { wrapText: true, vertical: 'top' }
        if (opts.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } }
      }
      line('CRAFT · Capacity Readiness & Fiduciary Assurance Toolkit', { size: 18, bold: true, fill: GREEN, color: 'FFFFFFFF' })
      line('Offline assessment workbook', { size: 14, bold: true, fill: LIGHT, color: GREEN })
      line(`Organisation: ${orgName}`, { bold: true })
      line(`For: ${label(mode)}`, { bold: true })
      line(`Prepared on ${new Date().toISOString().slice(0, 10)} by ${currentUser.email}`)
      line('')
      line('How to fill it in', { bold: true, color: GREEN })
      for (const t of [
        '1. Fill only the yellow cells: "Score (0-5)" (choose from the list) and "Notes and evidence" (what you have, or what is missing).',
        '2. Leave a score blank if you have not answered it yet. Blank scores are not saved, so you can fill the workbook in several sittings.',
        '3. Do not rename the sheets, change the codes or move the columns. You may sort or filter rows.',
        '4. Save it as an Excel workbook (.xlsx). Work offline as long as you need.',
        '5. Upload it on CRAFT: Assessment Wizard → Offline workbook → Upload a filled workbook. CRAFT checks every row and shows what it will save before saving; if a row is wrong, nothing is saved and you are told which row to fix.',
        '6. No connection at all? Send the saved file to your independent assessor or the CRAFT team, who can upload it for you.',
      ]) line(t)
      line('')
      line('What the scores mean', { bold: true, color: GREEN })
      line('CRAFT-ONC: each indicator lists what 0 to 5 means; pick the highest level that is fully true today and backed by a document. 5-tier assessment: 0 = absent, 1 = initial, 2 = developing, 3 = established, 4 = advanced, 5 = leading.')
      line(mode === 'own'
        ? 'These are your organisation\'s own answers. Your independent assessor scores the same questions separately; CRAFT compares the two in Trust Delta & Verify.'
        : 'These are the independent assessor\'s scores. The organisation\'s own answers are kept separately and are not changed by this workbook.')

      const sheet = (name: string, cols: { header: string; width: number; input?: boolean }[], rows: unknown[][]) => {
        const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] })
        ws.columns = cols.map((c) => ({ header: c.header, width: c.width }))
        rows.forEach((r) => ws.addRow(r))
        ws.getRow(1).eachCell((c) => {
          c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
          c.alignment = { wrapText: true, vertical: 'middle' }
        })
        ws.getRow(1).height = 32
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } }
        const scoreCol = cols.findIndex((c) => c.header === COLS.score) + 1
        for (let i = 2; i <= rows.length + 1; i++) {
          const row = ws.getRow(i)
          cols.forEach((c, j) => {
            const cell = row.getCell(j + 1)
            cell.alignment = { wrapText: true, vertical: 'top' }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.input ? INPUT : j === 0 ? GREY : 'FFFFFFFF' } }
            if (c.input) cell.protection = { locked: false }
          })
          row.getCell(scoreCol).dataValidation = { type: 'whole', operator: 'between', allowBlank: true, formulae: [0, 5], showErrorMessage: true, errorTitle: 'Score', error: 'Enter a whole number from 0 to 5, or leave it blank.' }
        }
        // Questions and codes are locked so rows cannot be broken; sorting and filtering still work.
        void ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true, sort: true, autoFilter: true })
      }

      const dims = Object.fromEntries(CRAFT_ONC.dimensions.map((d) => [d.key, d.name]))
      sheet(SHEETS.onc, [
        { header: COLS.code, width: 15 }, { header: 'Area', width: 22 }, { header: 'Indicator', width: 24 }, { header: 'Question', width: 50 },
        ...[0, 1, 2, 3, 4, 5].map((n) => ({ header: `${n} means`, width: 28 })),
        { header: COLS.score, width: 11, input: true }, { header: COLS.notes, width: 45, input: true },
      ], CRAFT_ONC.indicators.map((q) => [q.id, dims[q.dimension] ?? q.dimension, q.domain, q.question, ...[0, 1, 2, 3, 4, 5].map((n) => q.soe[n as 0]), filled[q.id] ?? null, '']))

      sheet(SHEETS.wizard, [
        { header: COLS.code, width: 12 }, { header: 'Tier', width: 6 }, { header: 'Domain', width: 22 }, { header: 'Question', width: 60 },
        { header: 'Evidence to look for', width: 40 }, { header: COLS.score, width: 11, input: true }, { header: COLS.notes, width: 45, input: true },
      ], questions.map((q) => [q.id, q.tier, q.domain, q.question, (q.evidence ?? []).join('; '), filled[q.id] ?? null, '']))

      const meta = wb.addWorksheet(SHEETS.meta, { state: 'veryHidden' })
      meta.addRows([['orgId', orgId], ['orgName', orgName], ['mode', mode], ['version', WORKBOOK_VERSION], ['generatedAt', new Date().toISOString()]])

      const blob = new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `CRAFT ${orgName.replace(/[^\w -]+/g, '').slice(0, 40)} ${mode === 'own' ? 'own answers' : 'independent'} ${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
      setMsg({ ok: 'Workbook downloaded. Fill it in offline, then upload it here.' })
    } catch (err) {
      setMsg({ problems: [`The workbook could not be prepared: ${err instanceof Error ? err.message : 'unknown error'}`] })
    } finally { setBusy('') }
  }

  const upload = async (file: File) => {
    setBusy('Reading the workbook…'); setMsg(null); setPending(null)
    try {
      if (!/\.xlsx$/i.test(file.name) || file.size > 10 * 1024 * 1024) throw new Error('Choose the .xlsx workbook (under 10 MB).')
      const ExcelJS = await excel()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const meta = Object.fromEntries((wb.getWorksheet(SHEETS.meta)?.getSheetValues() ?? []).filter(Boolean).map((r) => [String((r as unknown[])[1]), String((r as unknown[])[2] ?? '')]))
      if (!meta.orgId) throw new Error('This is not a CRAFT offline workbook (download one from this page).')
      if (meta.orgId !== orgId) throw new Error(`This workbook is for ${meta.orgName || 'another organisation'}, not ${orgName}. Open that organisation first.`)
      const fileMode = meta.mode === 'independent' ? 'independent' : 'own'
      const rows: ReadRow[] = []
      for (const name of [SHEETS.onc, SHEETS.wizard]) {
        const ws = wb.getWorksheet(name)
        if (!ws) continue
        const header = (ws.getRow(1).values as unknown[]).map((v) => String(v ?? '').trim())
        const at = (h: string) => header.indexOf(h)
        if (at(COLS.code) < 0 || at(COLS.score) < 0) throw new Error(`The sheet "${name}" has lost its "${COLS.code}" or "${COLS.score}" column.`)
        ws.eachRow((row, n) => { if (n > 1) rows.push({ sheet: name, row: n, code: cellText(row.getCell(at(COLS.code)).value), score: cellText(row.getCell(at(COLS.score)).value), notes: at(COLS.notes) > 0 ? cellText(row.getCell(at(COLS.notes)).value) : '' }) })
      }
      const known = new Set([...CRAFT_ONC.indicators.map((q) => q.id), ...questions.map((q) => q.id)])
      const parsed = readAnswers(rows, known)
      if (parsed.problems.length) { setMsg({ problems: ['Nothing was saved. Fix these rows and upload again:', ...parsed.problems.slice(0, 30)] }); return }
      if (!Object.keys(parsed.scores).length && !Object.keys(parsed.notes).length) { setMsg({ problems: ['The workbook has no scores or notes filled in yet.'] }); return }
      setPending({ mode: fileMode, scores: parsed.scores, notes: parsed.notes })
    } catch (err) {
      setMsg({ problems: [err instanceof Error ? err.message : 'The workbook could not be read.'] })
    } finally { setBusy(''); if (fileRef.current) fileRef.current.value = '' }
  }

  const save = async () => {
    if (!pending) return
    setBusy('Saving…')
    try {
      const body = pending.mode === 'own'
        ? { orgId, scores: pending.scores, notes: pending.notes }
        : { orgId, assessor: { scores: pending.scores, notes: pending.notes } }
      const r = await fetch('/api/responses', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => null)
      if (r.status === 403) throw new Error(pending.mode === 'own' ? `Your account cannot save ${orgName}'s own answers. Ask the organisation, or the CRAFT team, to upload it.` : 'Only the organisation\'s independent assessor (or the CRAFT team) can upload independent scores.')
      if (!r.ok) throw new Error([d?.error ?? 'The upload failed.', ...(d?.problems ?? [])].join(' '))
      await refreshScores()
      setMsg({ ok: `Saved ${Object.keys(pending.scores).length} scores and ${Object.keys(pending.notes).length} notes as ${label(pending.mode).toLowerCase()}.${pending.mode === 'independent' ? ' Reload the page to see them.' : ''}` })
      setPending(null)
    } catch (err) {
      setMsg({ problems: [err instanceof Error ? err.message : 'The upload failed.'] })
    } finally { setBusy('') }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        <div>
          <p className="font-semibold text-slate-800">Offline workbook</p>
          <p className="text-sm text-slate-600">Download a CRAFT workbook for {orgName} with CRAFT-ONC (44 indicators) and the {questions.length} 5-tier questions in its scope. Fill it in without a connection, then upload it here. Your saved scores are already filled in.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {modes.length > 1 && (
          <select value={mode} onChange={(e) => setMode(e.target.value as WorkbookMode)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            {modes.map((m) => <option key={m} value={m}>{label(m)}</option>)}
          </select>
        )}
        <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void download()}><Download className="h-4 w-4" /> Download workbook</Button>
        <Button variant="outline" size="sm" disabled={!!busy} onClick={() => fileRef.current?.click()}><UploadCloud className="h-4 w-4" /> Upload a filled workbook</Button>
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }} />
        {busy && <span role="status" className="text-sm text-slate-500">{busy}</span>}
      </div>
      {pending && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>Ready to save as <b>{label(pending.mode).toLowerCase()}</b>: {Object.keys(pending.scores).length} scores and {Object.keys(pending.notes).length} notes. Existing scores for these questions will be replaced.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={!!busy} onClick={() => void save()}>Save to CRAFT</Button>
            <Button size="sm" variant="outline" onClick={() => setPending(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {msg?.ok && <p role="status" className="text-sm text-emerald-700">{msg.ok}</p>}
      {msg?.problems && <ul role="alert" className="list-disc space-y-0.5 pl-5 text-sm text-rose-700">{msg.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
    </div>
  )
}

/** Excel cells can hold rich text, formulas or hyperlinks; read them as plain text. */
function cellText(v: unknown): unknown {
  if (v && typeof v === 'object') {
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: string }
    if (o.richText) return o.richText.map((t) => t.text).join('')
    if ('result' in o) return o.result
    if (o.text) return o.text
  }
  return v
}
