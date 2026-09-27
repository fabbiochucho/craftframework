import { useRef, useState } from 'react'
import { Download, UploadCloud, ShieldCheck, Loader2, FileSpreadsheet } from 'lucide-react'
import { Button, Toast } from './ui'
import { MOCK_QUESTIONS } from '../lib/data'
import { useScoresCtx } from '../lib/context'

// Builds an Excel-compatible CSV template covering the full question bank.
function buildTemplate(): string {
  const header = 'Question_ID,Domain,Tier,Score (0-5)'
  const rows = MOCK_QUESTIONS.map(q => `${q.id},"${q.domain}",${q.tier},`)
  return [header, ...rows].join('\n')
}

function downloadTemplate() {
  const blob = new Blob([buildTemplate()], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'CRAFT_Assessment_Template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// Parses an uploaded CSV template into a { questionId: score } map.
function parseCsv(text: string): Record<string, number> {
  const out: Record<string, number> = {}
  const valid = new Set(MOCK_QUESTIONS.map(q => q.id))
  text.split(/\r?\n/).slice(1).forEach(line => {
    if (!line.trim()) return
    const cols = line.split(',')
    const id = cols[0]?.trim()
    const raw = cols[cols.length - 1]?.trim()
    const score = Number(raw)
    if (id && valid.has(id) && raw !== '' && !Number.isNaN(score)) {
      out[id] = Math.max(0, Math.min(5, Math.round(score)))
    }
  })
  return out
}

type State = 'idle' | 'scanning' | 'done' | 'error'

export function ExcelImport({ orgId, onImported }: { orgId: string; onImported?: (n: number) => void }) {
  const { bulkImportScores } = useScoresCtx()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>('idle')
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState('')

  function handleFile(file: File) {
    setError('')
    // Only .csv is actually parsed (see parseCsv below) — there's no .xlsx parser bundled,
    // and the downloadable template is a .csv file anyway, so don't accept a format we can't
    // really read.
    const okExt = /\.csv$/i.test(file.name)
    if (!okExt) {
      setState('error')
      setError('Only .csv files under 5MB are accepted.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setState('error')
      setError('File exceeds the 5MB size limit.')
      return
    }
    setState('scanning')
    // No real AV/sanitization pass runs here — this delay is just UI pacing, not a security
    // control. Don't claim scanning/sanitizing in the copy shown during or after this step.
    setTimeout(() => {
      const reader = new FileReader()
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : ''
        const imported = parseCsv(text)
        const n = Object.keys(imported).length

        if (n === 0) {
          setState('error')
          setError('No valid rows found. Use the downloaded template and fill in the Score column.')
          return
        }

        bulkImportScores(orgId, imported)
        setState('done')
        setToast(`✅ Imported ${n} response${n === 1 ? '' : 's'}.`)
        onImported?.(n)
      }
      reader.readAsText(file)
    }, 1600)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-base font-bold text-slate-900">Secure Bulk Import</p>
          <p className="text-sm text-slate-500">Download the template, fill it offline, upload to calculate scores instantly.</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4" /> Download CSV Template
        </Button>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          const f = e.dataTransfer.files?.[0]
          if (f) handleFile(f)
        }}
        onClick={() => state !== 'scanning' && inputRef.current?.click()}
        className={`mt-4 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? 'border-emerald-400 bg-emerald-50'
            : state === 'error' ? 'border-rose-300 bg-rose-50'
            : state === 'done' ? 'border-emerald-300 bg-emerald-50'
            : 'border-slate-300 bg-slate-50 hover:border-emerald-300'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        {state === 'scanning' ? (
          <div className="flex flex-col items-center gap-2 text-emerald-700">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm font-semibold">Processing…</p>
          </div>
        ) : state === 'done' ? (
          <div className="flex flex-col items-center gap-2 text-emerald-700">
            <ShieldCheck className="h-7 w-7" />
            <p className="text-sm font-semibold">Import complete.</p>
            <p className="text-xs text-slate-500">Upload another file to re-import</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-600">
            <UploadCloud className="h-7 w-7 text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">
              <FileSpreadsheet className="mr-1 inline h-4 w-4" />
              Only .csv files under 5MB are accepted.
            </p>
            <p className="text-xs text-slate-500">Drag &amp; drop or click to browse</p>
            {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
          </div>
        )}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
