// The independent assessor's review of a public health institute's NPHI, JEE or SPAR assessment: a declaration of
// independence first, then their own level for each item beside the institute's (/api/nphi).
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../components/ui'
import { AutosaveStatus, useAssessmentAutosave } from '../lib/assessmentAutosave'

type Item = { id: string; sectionId: string; name: string; description: string; critical?: boolean }
type Detail = {
  institute: string
  summary: { label: string; version: number; status: string; reportingPeriod: string; own: { overall: number | null; completeness: number }; independent: { overall: number | null; answered: number; total: number } }
  catalogue: { title: string; version: string; source: { title: string; url: string }; levels: string[]; evidenceCap: number | null; disclaimer: string; sections: { id: string; name: string; intro: string }[]; items: Item[] }
  own: Record<string, { score: number | null; notApplicable: boolean; naReason: string; evidence: string | null }>
  independent: Record<string, { score: number | null; notApplicable: boolean; note: string; updatedAt?: string }>
  canReview: boolean
  declaration: { organisation: string; declaredAt: string } | null
}
type Draft = { score: string; na: boolean; note: string }

const pct = (v: number | null) => (v === null ? '—' : `${v}%`)

export function NphiReviewPage({ id }: { id?: number }) {
  const [d, setD] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [section, setSection] = useState('')
  const [org, setOrg] = useState('')
  const [independent, setIndependent] = useState(false)
  const load = () => {
    if (!id) return
    fetch(`/api/nphi?assessment=${id}`).then(async (r) => {
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(r.status === 403 ? 'Only the institute, its invited independent assessor and the CRAFT team can see this assessment.'
        : r.status === 404 ? 'There is no NPHI, JEE or SPAR assessment at this link. It may have been removed, or the link is incomplete. Open the assessment from the institute’s dashboard instead.'
        : b.error || 'This assessment could not be loaded.')
      setD(b)
      setSection((s) => s || b.catalogue.sections[0]?.id || '')
    }).catch((e) => setError((e as Error).message))
  }
  useEffect(load, [id])
  const send = async (method: 'POST' | 'PUT', body: object) => {
    setError('')
    const r = await fetch('/api/nphi', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assessment: id, ...body }) })
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error || 'Not saved'); return false }
    load()
    return true
  }

  if (!id) return <p className="text-sm text-slate-600">Open an assessment from the institute's dashboard.</p>
  if (!d) return error ? <div className="space-y-2"><p role="alert" className="text-sm text-rose-700">{error}</p><Link to="/dashboard" className="text-sm text-emerald-700 underline">Go to the dashboard</Link></div> : <p className="text-sm text-slate-500">Loading…</p>
  const s = d.summary
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-slate-500">{d.institute} · <Link to="/dashboard" className="underline">Dashboard</Link></p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Independent review: {s.label}</h1>
        <p className="mt-1 text-sm text-slate-600">v{s.version}{s.reportingPeriod && ` (${s.reportingPeriod})`} · {s.status.replace('_', ' ')} · institute {pct(s.own.overall)}, {s.own.completeness}% answered · independent assessor {pct(s.independent.overall)} ({s.independent.answered} of {s.independent.total} items)</p>
        <p className="mt-1 text-xs text-slate-500">{d.catalogue.version} · <a className="underline" href={d.catalogue.source.url} target="_blank" rel="noreferrer">{d.catalogue.source.title}</a>. {d.catalogue.disclaimer}</p>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

      {d.canReview && !d.declaration && (
        <Card><CardHeader><CardTitle>Declare your independence</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-slate-600">Before you score, confirm that you are independent of {d.institute}. Your levels are shown beside the institute's own, to the institute and to any funder of a grant this assessment is linked to.</p>
            <div className="max-w-md"><Input label="The organisation you assess for" placeholder="For example DiBadili Institute or Africa CDC" value={org} onChange={(e) => setOrg(e.target.value)} /></div>
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={independent} onChange={(e) => setIndependent(e.target.checked)} />
              <span>I declare that I am independent of {d.institute} and have no conflict of interest in this assessment.</span></label>
            <Button disabled={!org.trim() || !independent} onClick={() => void send('POST', { declare: true, organisation: org })}>Declare and start</Button>
          </CardContent></Card>
      )}
      {d.declaration && <p className="text-sm text-slate-600">You declared your independence for {d.declaration.organisation} on {new Date(d.declaration.declaredAt).toLocaleDateString()}.</p>}

      <label className="block max-w-xl text-sm"><span className="font-medium text-slate-700">Section</span>
        <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={section} onChange={(e) => setSection(e.target.value)}>
          {d.catalogue.sections.map((x) => <option key={x.id} value={x.id}>{x.name} ({d.catalogue.items.filter((i) => i.sectionId === x.id && d.independent[i.id]).length}/{d.catalogue.items.filter((i) => i.sectionId === x.id).length})</option>)}
        </select></label>

      {d.catalogue.items.map(i => <NphiItem key={i.id} id={id} i={i} d={d} reload={load} hidden={i.sectionId !== section} />)}
      <Link to="/assessment-archive" className="text-sm text-emerald-700 underline">My saved assessment revisions</Link>
    </div>
  )
}

function NphiItem({ id, i, d, reload, hidden }: { id: number; i: Item; d: Detail; reload: () => void; hidden: boolean }) {
  const own = d.own[i.id]
  const mine = d.independent[i.id]
  const editable = d.canReview && !!d.declaration
  const draft = useAssessmentAutosave<Draft>({
    key: `nphi:${id}:${i.id}`, initial: { score: mine?.score ? String(mine.score) : '', na: !!mine?.notApplicable, note: mine?.note ?? '' }, enabled: editable,
    validate: x => x.na ? x.note.trim() ? null : 'Not applicable needs a reason.' : x.score ? null : 'Choose a level to save.',
    write: async x => {
      const response = await fetch('/api/nphi', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assessment: id, item: i.id, ...(x.na ? { notApplicable: true } : { score: Number(x.score) }), note: x.note }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Assessment could not be saved.')
      reload()
      return body
    },
  })
  const v = draft.value
  const set = (patch: Partial<Draft>) => draft.setValue(previous => ({ ...previous, ...patch }))
  const levelName = (n: number | null) => n === null ? '' : d.catalogue.levels[n - 1] ?? String(n)
  return (
          <Card key={i.id} className={hidden ? 'hidden' : ''}><CardContent className="space-y-2 text-sm">
            <p className="font-semibold text-slate-800">{i.id} · {i.name}{i.critical && <span className="ml-2 rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-700">critical</span>}</p>
            {i.description && <p className="text-slate-600">{i.description}</p>}
            <p className="text-slate-700"><b>Institute:</b> {!own ? 'not answered' : own.notApplicable ? `not applicable (${own.naReason})` : `${levelName(own.score)}${own.evidence ? ` · evidence: ${own.evidence}` : ' · no evidence document'}`}</p>
            {!editable && <p className="text-slate-700"><b>Independent assessor:</b> {!mine ? 'not scored' : mine.notApplicable ? `not applicable (${mine.note})` : `${levelName(mine.score)}${mine.note ? ` · ${mine.note}` : ''}`}</p>}
            {editable && (
              <div className="flex flex-wrap items-end gap-3">
                {!v.na && <div className="w-full max-w-md"><Select placeholder="Not scored" label="Your level" value={v.score} onChange={(score) => set({ score })} options={d.catalogue.levels.map((l, n) => ({ value: String(n + 1), label: l }))} /></div>}
                <label className="flex items-center gap-1"><input type="checkbox" checked={v.na} onChange={(e) => set({ na: e.target.checked })} /> Not applicable</label>
                <div className="min-w-[260px] flex-1"><Input maxLength={2000} label={v.na ? 'Why it does not apply' : 'What you saw (optional)'} value={v.note} onChange={(e) => set({ note: e.target.value })} /></div>
                <Button size="sm" disabled={v.na ? !v.note.trim() : !v.score} onClick={() => void draft.save()}>Save</Button>
                <AutosaveStatus draft={draft} savedAt={mine?.updatedAt} />
              </div>
            )}
          </CardContent></Card>
  )
}
