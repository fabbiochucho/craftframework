import { useId, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { api, wsPath } from '../../lib/workspaceApi'
import { Badge, Button, Card, CardContent, Input, ProgressBar, Select, Table, Tbody, Td, Th, Thead } from '../../components/ui'
import { ErrorLine, Header, State, useAction, useApi } from './shared'
import {
  CONFIGURATIONS, DEAL_KENNEDY, HANDY, LEARNING_OUTCOMES, METAPHORS, ORG_DESIGN_VERSION, RUBRIC, RUBRIC_PASS, SECTIONS,
  optionLabel, type Field, type Section,
} from '../../lib/org-design'

const dash = (workspaceId: string) => ({ to: '/app/workspaces/$workspaceId/dashboard', params: { workspaceId }, label: 'Dashboard' })
const cfgLabel = (id: string | null) => CONFIGURATIONS.find(c => c.id === id)?.label ?? '—'
const RUBRIC_SECTION: Section = {
  id: 'rubric', title: 'Report review', chapter: '', intro: `Score your written analysis 1–10 on each criterion before submitting it. Marks are weighted and grouped by learning outcome; ${RUBRIC_PASS}/100 is the pass mark.`,
  fields: RUBRIC.map(r => ({ key: r.id, label: `Ch. ${r.chapter} — ${r.criterion} (weight ${r.weight})`, type: 'scale', min: 1, max: 10, minLabel: 'Weak', maxLabel: 'Excellent' })),
}

export function OrgDesignListPage({ workspaceId }: { workspaceId: string }) {
  const list = useApi<any[]>(wsPath(workspaceId, '/org-design'))
  const [title, setTitle] = useState('')
  const { run, error, busy } = useAction(list.reload)
  return (
    <div className="space-y-6">
      <Header title="Organisational design & diagnosis" subtitle="Identify your structure and culture, test the design with Goold and Campbell’s nine tests, and generate an organisational analysis report." back={dash(workspaceId)} />
      <Card><CardContent className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1"><Input label="New review (e.g. Ministry of Health — 2026 design review)" value={title} onChange={e => setTitle(e.target.value)} /></div>
        <Button disabled={busy || !title.trim()} onClick={() => run(async () => { await api(wsPath(workspaceId, '/org-design'), { method: 'POST', body: { title } }); setTitle('') })}>Start review</Button>
      </CardContent></Card>
      <ErrorLine error={error} /><State loading={list.loading} error={list.error} />
      {list.data && !list.data.length && <p className="text-sm text-slate-600">No reviews yet.</p>}
      {!!list.data?.length && <Table><Thead><tr><Th>Review</Th><Th>Structure</Th><Th>Design verdict</Th><Th>Status</Th><Th>Updated</Th></tr></Thead>
        <Tbody>{list.data.map(r => (
          <tr key={r.id}>
            <Td><Link className="font-semibold text-emerald-700 underline" to="/app/workspaces/$workspaceId/org-design/$reviewId" params={{ workspaceId, reviewId: String(r.id) }}>{r.title}</Link></Td>
            <Td>{cfgLabel(r.dominant)}</Td><Td className="text-xs">{r.verdict}</Td>
            <Td><Badge className={r.status === 'final' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>{r.status}</Badge></Td>
            <Td>{new Date(r.updatedAt).toLocaleDateString()}</Td>
          </tr>))}</Tbody></Table>}
    </div>
  )
}

export function OrgDesignPage({ workspaceId, reviewId }: { workspaceId: string; reviewId: string }) {
  const rv = useApi<any>(wsPath(workspaceId, `/org-design/${reviewId}`))
  const [tab, setTab] = useState('intro')
  const { run, error, busy } = useAction(rv.reload)
  if (!rv.data) return <State loading={rv.loading} error={rv.error} />
  const r = rv.data, d = r.diagnosis, frozen = r.status === 'final'
  const section = tab === 'rubric' ? RUBRIC_SECTION : SECTIONS.find(s => s.id === tab)!
  const pct = (id: string) => d.completeness.find((c: any) => c.id === id)?.percent
  return (
    <div className="space-y-6">
      <Header title={r.title} subtitle={`${r.methodologyVersion ?? ORG_DESIGN_VERSION} · prepared by ${r.preparedBy}${frozen ? ` · finalised by ${r.approvedBy}` : ''}`}
        back={{ to: '/app/workspaces/$workspaceId/org-design', params: { workspaceId }, label: 'All reviews' }} />
      <div className="flex flex-wrap gap-2">
        <a className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800" href={`/api${wsPath(workspaceId, `/org-design/${reviewId}/report`)}`}>Download report (Word)</a>
        {!frozen && <Button variant="outline" disabled={busy} onClick={() => run(() => api(wsPath(workspaceId, `/org-design/${reviewId}/finalise`), { method: 'POST', body: {} }))}>Finalise (admin)</Button>}
        {frozen && <Badge className="bg-emerald-100 text-emerald-800">Final — answers are frozen</Badge>}
      </div>
      <ErrorLine error={error} />
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr_20rem]">
        <nav aria-label="Review sections" className="space-y-1">
          {[...SECTIONS, RUBRIC_SECTION].map(s => (
            <button key={s.id} type="button" onClick={() => setTab(s.id)} aria-current={tab === s.id ? 'page' : undefined}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${tab === s.id ? 'bg-emerald-100 font-semibold text-emerald-900' : 'hover:bg-slate-100'}`}>
              <span>{s.chapter && `${s.chapter}. `}{s.title}{s.optional ? ' (optional)' : ''}</span>
              {s.id !== 'rubric' && <span className="text-xs text-slate-500">{pct(s.id)}%</span>}
            </button>))}
        </nav>
        <SectionForm key={tab} section={section} values={r.data?.[tab] ?? {}} disabled={frozen}
          save={values => api(wsPath(workspaceId, `/org-design/${reviewId}/sections/${tab}`), { method: 'PUT', body: values })} onSaved={rv.reload} />
        <DiagnosisPanel d={d} />
      </div>
    </div>
  )
}

function SectionForm({ section, values, disabled, save, onSaved }: { section: Section; values: Record<string, any>; disabled: boolean; save: (v: Record<string, unknown>) => Promise<unknown>; onSaved: () => void | Promise<void> }) {
  const [v, setV] = useState<Record<string, any>>(values)
  const [dirty, setDirty] = useState(false)
  const { run, error, busy } = useAction(onSaved)
  const set = (k: string, x: unknown) => { setV({ ...v, [k]: x }); setDirty(true) }
  // Clear the unsaved flag only when the save succeeds; edits stay in place either way.
  const submit = () => run(async () => {
    await save(Object.fromEntries(section.fields.filter(f => f.key in v).map(f => [f.key, v[f.key] === '' ? null : v[f.key]])))
    setDirty(false)
  })
  return (
    <Card><CardContent className="space-y-4">
      <div><h2 className="text-lg font-semibold">{section.title}</h2><p className="text-sm text-slate-600">{section.intro}</p>
        {section.suggestedWords && <p className="text-xs text-slate-500">Suggested length in the report: {section.suggestedWords[0]}–{section.suggestedWords[1]} words.</p>}</div>
      {section.id === 'tests' && <p className="rounded bg-slate-50 p-2 text-xs text-slate-600">Fit tests: market advantage, parenting advantage, people, feasibility. Good-design tests: specialist cultures, difficult links, redundant hierarchy, accountability, flexibility.</p>}
      {section.fields.map(f => <FieldInput key={f.key} field={f} value={v[f.key]} onChange={x => set(f.key, x)} disabled={disabled} />)}
      <ErrorLine error={error} />
      {!disabled && <div className="sticky bottom-0 flex gap-2 bg-white py-2"><Button disabled={busy || !dirty} onClick={submit}>Save section</Button>{dirty && <span className="self-center text-xs text-amber-700">Unsaved changes</span>}</div>}
    </CardContent></Card>
  )
}

function FieldInput({ field: f, value, onChange, disabled }: { field: Field; value: any; onChange: (v: unknown) => void; disabled: boolean }) {
  const id = useId()
  const help = f.help && <p className="text-xs text-slate-500">{f.help}</p>
  if (f.type === 'text') return <div><Input label={f.label} value={value ?? ''} disabled={disabled} onChange={e => onChange(e.target.value)} />{help}</div>
  if (f.type === 'textarea') return (
    <div><label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{f.label}</label>{help}
      <textarea id={id} rows={4} maxLength={8000} disabled={disabled} value={value ?? ''} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" /></div>)
  if (f.type === 'select') return <div><Select label={f.label} placeholder="Choose…" value={value ?? ''} onChange={x => !disabled && onChange(x)} options={f.options!} />{help}</div>
  if (f.type === 'scale') {
    const opts = Array.from({ length: f.max! - f.min! + 1 }, (_, i) => f.min! + i)
    return (
      <fieldset disabled={disabled}><legend className="mb-1 text-sm font-medium text-slate-700">{f.label}</legend>{help}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{f.minLabel}</span>
          {opts.map(n => (
            <label key={n} className={`cursor-pointer rounded-md border px-2.5 py-1 text-sm ${value === n ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>
              <input type="radio" className="sr-only" name={id} checked={value === n} onChange={() => onChange(n)} />{n}</label>))}
          <span>{f.maxLabel}</span>
          {value != null && <button type="button" className="text-xs underline" onClick={() => onChange(null)}>clear</button>}</div></fieldset>)
  }
  const rows: Record<string, string>[] = Array.isArray(value) ? value : []
  const setRow = (i: number, k: string, x: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: x } : r)))
  return (
    <div><p className="mb-1 text-sm font-medium text-slate-700">{f.label}</p>
      <Table><Thead><tr>{f.columns!.map(c => <Th key={c.key}>{c.label}</Th>)}<Th>Remove</Th></tr></Thead>
        <Tbody>{rows.map((r, i) => (
          <tr key={i}>{f.columns!.map(c => <Td key={c.key}><input aria-label={`${c.label} row ${i + 1}`} disabled={disabled} maxLength={300} value={r[c.key] ?? ''} onChange={e => setRow(i, c.key, e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></Td>)}
            <Td><Button size="sm" variant="outline" disabled={disabled} onClick={() => onChange(rows.filter((_, j) => j !== i))}>Remove</Button></Td></tr>))}</Tbody></Table>
      {!disabled && rows.length < 50 && <Button size="sm" variant="outline" onClick={() => onChange([...rows, Object.fromEntries(f.columns!.map(c => [c.key, '']))])}>Add row</Button>}
    </div>)
}

function DiagnosisPanel({ d }: { d: any }) {
  const c = d.configuration, cu = d.culture, t = d.tests
  return (
    <aside aria-label="Diagnosis" className="space-y-4">
      <Card><CardContent className="space-y-2 text-sm">
        <h2 className="font-semibold">Structure</h2>
        {c.scores.map((s: any) => (
          <div key={s.id}><div className="flex justify-between text-xs"><span>{s.label}</span><span>{s.score ?? '—'}</span></div><ProgressBar value={s.score ?? 0} max={5} /></div>))}
        <p><b>{cfgLabel(c.dominant)}</b>{c.hybridWith && <> (hybrid with {cfgLabel(c.hybridWith)})</>}</p>
        {c.expected && <p className={c.fit === 'mismatch' ? 'text-rose-700' : 'text-slate-600'}>Environment favours: {cfgLabel(c.expected)} — {c.fit === 'fits' ? 'fits' : 'mismatch'}</p>}
      </CardContent></Card>
      <Card><CardContent className="space-y-1 text-sm">
        <h2 className="font-semibold">Culture</h2>
        <p>Strength: {cu.strength ?? '—'}/5</p>
        <p>Handy: {optionLabel(HANDY, cu.handy.dominant) ?? '—'}{cu.handy.preferred && cu.handy.preferred !== cu.handy.dominant && <> → preferred {optionLabel(HANDY, cu.handy.preferred)}</>}</p>
        <p>Deal &amp; Kennedy: {optionLabel(DEAL_KENNEDY, cu.dealKennedy.type) ?? '—'}</p>
        <p>Metaphor: {optionLabel(METAPHORS, cu.metaphor) ?? '—'}</p>
      </CardContent></Card>
      <Card><CardContent className="space-y-1 text-sm">
        <h2 className="font-semibold">Nine tests</h2>
        <p>Fit: {t.fit.pass} pass · {t.fit.concern} concern · {t.fit.fail} fail</p>
        <p>Good design: {t.goodDesign.pass} pass · {t.goodDesign.concern} concern · {t.goodDesign.fail} fail</p>
        <p className="font-medium">{t.verdict}</p>
      </CardContent></Card>
      {d.findings.length > 0 && <Card><CardContent className="text-sm">
        <h2 className="font-semibold">Findings</h2>
        <ul className="list-disc space-y-1 pl-4">{d.findings.map((f: string) => <li key={f}>{f}</li>)}</ul>
      </CardContent></Card>}
      {d.rubric.overall !== null && <Card><CardContent className="text-sm">
        <h2 className="font-semibold">Report review</h2>
        {d.rubric.byOutcome.map((o: any) => <p key={o.outcome}>{LEARNING_OUTCOMES[o.outcome]}: {o.mark}</p>)}
        <p className="font-medium">Overall {d.rubric.overall}/100 — {d.rubric.pass ? 'meets' : 'below'} the pass mark</p>
      </CardContent></Card>}
    </aside>
  )
}
