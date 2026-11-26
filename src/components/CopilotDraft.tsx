import { useState } from 'react'
import { Button, Input } from './ui'

type Draft = { routed: boolean; message?: string; draft?: string; watermark?: string; citations?: Array<{ title: string; citedText: string }> }

// "Draft a starting point" for a low-scoring capacity domain (src/lib/copilot.ts). The result is a starting draft from
// approved templates, clearly marked: it is never saved as evidence and never changes the score.
export function CopilotDraft({ orgId, module, domainId, domainName }: { orgId: string; module: string; domainId: string; domainName: string }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!open) return <button type="button" className="text-xs font-semibold text-emerald-700 underline" onClick={() => setOpen(true)}>Draft a starting point</button>
  const ask = async () => {
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/copilot/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orgId, module, domainId, domainName, note }) })
      const body = await r.json()
      if (!r.ok) throw new Error(body.error ?? 'The drafting assistant is unavailable.')
      setResult(body)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const download = () => {
    const text = `${result!.watermark}\n\n${result!.draft}\n\nSources: ${[...new Set(result!.citations!.map((c) => c.title))].join('; ')}\n`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }))
    a.download = `${domainName.replace(/[^\w-]+/g, '-')}-starting-point.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
      {!result && <>
        <p className="text-slate-700">Get a starting draft (a procedure, template or charter) adapted from CRAFT-approved templates. It is a starting point to adapt and adopt, not evidence.</p>
        <Input label="What you need (optional)" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" disabled={busy} onClick={() => void ask()}>{busy ? 'Drafting…' : 'Draft it'}</Button>
      </>}
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      {result?.routed && <p role="status" className="text-slate-700">{result.message}</p>}
      {result && !result.routed && <>
        <p className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">{result.watermark}</p>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-white p-3 font-sans text-slate-800">{result.draft}</pre>
        <p className="text-xs text-slate-600">Sources: {[...new Set(result.citations?.map((c) => c.title))].join('; ')}</p>
        <Button size="sm" variant="outline" onClick={download}>Download draft</Button>
      </>}
    </div>
  )
}
