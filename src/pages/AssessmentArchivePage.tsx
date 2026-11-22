import { useEffect, useState } from 'react'
import { Card, CardContent, Input, Button } from '../components/ui'

type Revision = { id: number; source: string; assessmentId: string; recordKey: string; period: string | null; actor: string; savedAt: string; snapshot: unknown }
type Result = { revisions: Revision[]; next: number | null }

export function AssessmentArchivePage() {
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('')
  const [source, setSource] = useState('')
  const [before, setBefore] = useState<number | null>(null)
  useEffect(() => {
    const abort = new AbortController()
    const query = new URLSearchParams({ ...(period ? { period } : {}), ...(source ? { source } : {}), ...(before ? { before: String(before) } : {}) })
    fetch(`/api/assessment-archive?${query}`, { signal: abort.signal }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Archive could not be loaded.')
      setResult(body); setError('')
    }).catch(e => { if (!abort.signal.aborted) setError((e as Error).message) })
    return () => abort.abort()
  }, [period, source, before])
  return <div className="space-y-4">
    <h1 className="font-display text-2xl font-bold text-emerald-900">My assessment archive</h1>
    <p className="text-sm text-slate-600">Every successful save made by your account, with its reporting period and server timestamp. Current access permissions still apply. These revisions do not change or count towards live dashboard scores.</p>
    <div className="flex flex-wrap gap-3">
      <Input label="Reporting period" placeholder="For example 2026" value={period} onChange={e => { setPeriod(e.target.value); setBefore(null) }} />
      <label className="text-sm">Assessment type<select className="ml-2 rounded border p-2" value={source} onChange={e => { setSource(e.target.value); setBefore(null) }}>
        <option value="">All</option>{['capacity', 'review', 'workspace', 'independent', 'legacy', 'scores', 'funder'].map(x => <option key={x} value={x}>{x}</option>)}
      </select></label>
    </div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {!result && !error && <p>Loading saved revisions…</p>}
    {result && !result.revisions.length && <p className="text-sm text-slate-600">No saved revisions match this page. Historical revisions begin when archive recording is deployed; earlier live assessments remain available in their assessment lists.</p>}
    {result?.revisions.map(r => <Card key={r.id}><CardContent className="space-y-2">
      <p className="font-semibold">{r.source} · {r.recordKey} · {r.period || 'Continuous assessment (no reporting period assigned)'}</p>
      <p className="text-xs text-slate-500">Revision {r.id} · assessment {r.assessmentId} · <time dateTime={r.savedAt}>{new Date(r.savedAt).toLocaleString()}</time> ({r.savedAt})</p>
      <details><summary className="cursor-pointer text-sm text-emerald-700">Saved details</summary><pre className="overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">{JSON.stringify(r.snapshot, null, 2)}</pre></details>
    </CardContent></Card>)}
    <div className="flex gap-2"><Button variant="outline" onClick={() => setBefore(null)} disabled={!before}>Latest revisions</Button><Button variant="outline" disabled={!result?.next} onClick={() => setBefore(result?.next ?? null)}>Older revisions</Button></div>
  </div>
}
