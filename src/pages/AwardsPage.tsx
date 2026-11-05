// Awards & Issues: grants and contracts, funder measures, the organisation's issue register, consented sharing of the
// track record, and the funder's view. Rules in src/lib/awards.ts; every permission is enforced by /api/awards.
import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Tabs } from '../components/ui'
import { useWorkspace } from '../lib/context'
import { cn } from '../lib/utils'
import {
  AWARD_STATUS_LABEL, ISSUE_SOURCES, ISSUE_TYPES, MEASURE_KINDS, MEASURE_LABEL, SOURCE_LABEL, type AwardStatus, type TrackRecord,
} from '../lib/awards'
import { FUNDING_MODALITIES } from '../lib/data'
import { MilestonesCard } from '../components/MilestonesCard'

type Award = { id: string; title: string; funderName: string; funderEmail: string; agreementRef: string; value: string | null; currency: string; modality: string; startDate: string | null; endDate: string | null; status: AwardStatus }
type Measure = { id: string; awardId: string; kind: string; description: string; liftedWhen: string; status: string; imposedAt: string }
type IssueRow = { id: string; awardId: string | null; source: string; type: string; title: string; description: string; verified: boolean; orgResponse: string; status: string; dueDate: string | null; openedAt: string; closedAt: string | null; fixHeld: boolean | null }
type Share = { viewerEmail: string; level: 'summary' | 'full'; grantedAt: string }
type OrgData = { awards: Award[]; measures: Measure[]; issues: IssueRow[]; shares: Share[]; trackRecord: TrackRecord; repeatedTypes: string[] }

export async function awardsApi<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/awards${path}`, init && { method: init.method, headers: { 'content-type': 'application/json' }, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const body = await res.json().catch(() => ({})) as T & { error?: string }
  if (!res.ok) throw new Error(body.error === 'mfa_required' ? 'Confirm your two-step sign-in, then try again.' : body.error ?? `Request failed (${res.status})`)
  return body
}

const label = (s: string) => s.replace(/_/g, ' ')

export function AwardsPage() {
  const { currentOrg } = useWorkspace()
  const orgId = currentOrg?.id ?? ''
  const [tab, setTab] = useState('awards')
  const [data, setData] = useState<OrgData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!orgId) return
    try { setData(await awardsApi<OrgData>(`?orgId=${encodeURIComponent(orgId)}`)); setError(null) } catch (e) { setError((e as Error).message) }
  }, [orgId])
  useEffect(() => { void load() }, [load])
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); await load() } catch (e) { setError((e as Error).message) } }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-emerald-900">Awards &amp; Issues</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Your grants and contracts, any measures a funder has applied, and every issue raised about your organisation, on any award or after close-out. You decide who outside your organisation sees your track record.</p>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <Tabs tabs={[{ id: 'awards', label: 'Awards' }, { id: 'issues', label: 'Issue register' }, { id: 'sharing', label: 'Sharing' }, { id: 'funder', label: 'Funder view' }]} active={tab} onChange={setTab} />
      {tab === 'funder' ? <FunderView /> : !data ? <p className="text-sm text-slate-500">Loading…</p> : (
        <>
          {tab === 'awards' && <AwardsTab orgId={orgId} d={data} run={run} />}
          {tab === 'issues' && <IssuesTab orgId={orgId} d={data} run={run} />}
          {tab === 'sharing' && <SharingTab orgId={orgId} d={data} run={run} />}
        </>
      )}
    </div>
  )
}

type Run = (fn: () => Promise<unknown>) => Promise<void>

function AwardsTab({ orgId, d, run }: { orgId: string; d: OrgData; run: Run }) {
  const [f, setF] = useState({ title: '', funderName: '', funderEmail: '', agreementRef: '', value: '', currency: '', modality: '', startDate: '', endDate: '' })
  const [m, setM] = useState<Record<string, { kind: string; description: string; liftedWhen: string }>>({})
  const create = () => run(() => awardsApi('', { method: 'POST', body: { orgId, ...f, value: f.value ? Number(f.value) : null, startDate: f.startDate || null, endDate: f.endDate || null } }).then(() => setF({ ...f, title: '', agreementRef: '', value: '' })))
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Add an award</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <Input label="Funder" value={f.funderName} onChange={(e) => setF({ ...f, funderName: e.target.value })} />
            <Input label="Funder contact email (can see this award)" type="email" value={f.funderEmail} onChange={(e) => setF({ ...f, funderEmail: e.target.value })} />
            <Input label="Agreement reference" value={f.agreementRef} onChange={(e) => setF({ ...f, agreementRef: e.target.value })} />
            <div className="grid grid-cols-[1fr_6rem] gap-2"><Input label="Value" type="number" min={0} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /><Input label="Currency" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} /></div>
            <Select label="Funding model" value={f.modality} onChange={(modality) => setF({ ...f, modality })} options={[{ value: '', label: 'Not set' }, ...FUNDING_MODALITIES.map((x) => ({ value: x.id, label: x.label }))]} />
            <Input label="Start" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
            <Input label="End" type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
          </div>
          <Button onClick={create} disabled={f.title.trim().length < 2}>Add award</Button>
        </CardContent>
      </Card>
      {d.awards.map((a) => {
        const issues = d.issues.filter((i) => i.awardId === a.id)
        const measures = d.measures.filter((x) => x.awardId === a.id)
        const mf = m[a.id] ?? { kind: 'special_condition', description: '', liftedWhen: '' }
        return (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle>{a.title}</CardTitle>
              <p className="text-sm text-slate-500">{a.funderName || 'Funder not named'}{a.agreementRef && ` · ${a.agreementRef}`}{a.value && ` · ${Number(a.value).toLocaleString()} ${a.currency}`}{a.modality && ` · ${FUNDING_MODALITIES.find((x) => x.id === a.modality)?.label}`} · <b>{AWARD_STATUS_LABEL[a.status]}</b></p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Assessments for this award: <Link to="/capacity" className="text-emerald-700 underline">Pre-, During- and Post-Award in Capacity Assessment</Link></p>
              <div>
                <p className="font-medium">Funder measures</p>
                {measures.length === 0 ? <p className="text-slate-500">None.</p> : <ul className="mt-1 space-y-1">{measures.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded px-1.5 py-0.5 text-xs font-semibold', x.status === 'active' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600')}>{x.status}</span>
                    <span><b>{MEASURE_LABEL[x.kind as keyof typeof MEASURE_LABEL]}</b>: {x.description}{x.liftedWhen && <span className="text-slate-500"> (lifted when: {x.liftedWhen})</span>}</span>
                    {x.status === 'active' && <Button size="sm" variant="ghost" onClick={() => run(() => awardsApi(`/measures/${x.id}`, { method: 'PUT', body: { lift: true } }))}>Lift</Button>}
                  </li>))}</ul>}
                {a.status === 'active' && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-[12rem_1fr_1fr_auto] sm:items-end">
                    <Select label="Measure" value={mf.kind} onChange={(kind) => setM({ ...m, [a.id]: { ...mf, kind } })} options={MEASURE_KINDS.map((k) => ({ value: k, label: MEASURE_LABEL[k] }))} />
                    <Input label="Description" value={mf.description} onChange={(e) => setM({ ...m, [a.id]: { ...mf, description: e.target.value } })} />
                    <Input label="Lifted when" value={mf.liftedWhen} onChange={(e) => setM({ ...m, [a.id]: { ...mf, liftedWhen: e.target.value } })} />
                    <Button size="sm" variant="outline" disabled={mf.description.trim().length < 3} onClick={() => run(() => awardsApi(`/${a.id}/measures`, { method: 'POST', body: mf }))}>Record</Button>
                  </div>)}
              </div>
              <MilestonesCard awardId={a.id} />
              <p>Issues on this award: {issues.length} ({issues.filter((i) => i.status === 'open').length} open). See the issue register.</p>
              {a.status === 'active' && <Button size="sm" variant="outline" onClick={() => run(() => awardsApi(`/${a.id}`, { method: 'PUT', body: { close: true } }))}>Close award</Button>}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function TrackRecordCard({ t, repeated }: { t: TrackRecord; repeated?: string[] }) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-4">
      <p><b>{t.verifiedIssues}</b> verified issues ({t.open} open)</p>
      <p>Average <b>{t.averageDaysToFix ?? '–'}</b> days to fix</p>
      <p>Fixes held <b>{t.fixesHeld}</b>, failed <b>{t.fixesFailed}</b></p>
      <p>Recurrences <b>{t.recurrences}</b> across <b>{t.awards}</b> awards</p>
      <p className="sm:col-span-4 text-slate-600">By type: {Object.entries(t.byType).map(([k, n]) => `${label(k)} ${n}`).join(', ') || 'none'}{repeated?.length ? <> · <b className="text-amber-700">repeated on more than one award: {repeated.map(label).join(', ')}</b></> : null}</p>
    </div>
  )
}

function IssuesTab({ orgId, d, run }: { orgId: string; d: OrgData; run: Run }) {
  const [f, setF] = useState({ awardId: '', source: 'audit', type: 'financial', title: '', description: '', dueDate: '' })
  const [resp, setResp] = useState<Record<string, string>>({})
  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle>Track record (verified issues)</CardTitle></CardHeader><CardContent><TrackRecordCard t={d.trackRecord} repeated={d.repeatedTypes} /></CardContent></Card>
      <Card>
        <CardHeader><CardTitle>Record an issue</CardTitle><p className="text-sm text-slate-500">From any source, on an award or not, including after close-out.</p></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label="Award" value={f.awardId} onChange={(awardId) => setF({ ...f, awardId })} options={[{ value: '', label: 'Not linked to an award' }, ...d.awards.map((a) => ({ value: a.id, label: a.title }))]} />
            <Select label="Source" value={f.source} onChange={(source) => setF({ ...f, source })} options={ISSUE_SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))} />
            <Select label="Type" value={f.type} onChange={(type) => setF({ ...f, type })} options={ISSUE_TYPES.map((t) => ({ value: t, label: label(t) }))} />
            <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <Input label="Details" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            <Input label="Due" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
          </div>
          <Button disabled={f.title.trim().length < 3} onClick={() => run(() => awardsApi('/issues', { method: 'POST', body: { orgId, ...f, awardId: f.awardId || null, dueDate: f.dueDate || null } }).then(() => setF({ ...f, title: '', description: '' })))}>Record issue</Button>
        </CardContent>
      </Card>
      {d.issues.map((i) => (
        <Card key={i.id}><CardContent className="space-y-2 pt-4 text-sm">
          <p className="flex flex-wrap items-center gap-2"><b>{i.title}</b>
            <span className="rounded bg-slate-100 px-1.5 text-xs">{SOURCE_LABEL[i.source as keyof typeof SOURCE_LABEL]}</span><span className="rounded bg-slate-100 px-1.5 text-xs">{label(i.type)}</span>
            <span className={cn('rounded px-1.5 text-xs font-semibold', i.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')}>{i.status}</span>
            {i.verified ? <span className="rounded bg-sky-100 px-1.5 text-xs text-sky-800">verified</span> : <span className="rounded bg-slate-50 px-1.5 text-xs text-slate-500">not verified (never shared)</span>}
            <span className="text-xs text-slate-500">{d.awards.find((a) => a.id === i.awardId)?.title ?? 'no award'}</span></p>
          {i.description && <p className="text-slate-700">{i.description}</p>}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Input label="Your response (shown with the issue if you share full details)" value={resp[i.id] ?? i.orgResponse} onChange={(e) => setResp({ ...resp, [i.id]: e.target.value })} />
            <Button size="sm" variant="outline" onClick={() => run(() => awardsApi(`/issues/${i.id}`, { method: 'PUT', body: { orgResponse: resp[i.id] ?? i.orgResponse } }))}>Save response</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {i.status === 'open' ? <Button size="sm" onClick={() => run(() => awardsApi(`/issues/${i.id}`, { method: 'PUT', body: { status: 'closed' } }))}>Close</Button>
              : <Button size="sm" variant="ghost" onClick={() => run(() => awardsApi(`/issues/${i.id}`, { method: 'PUT', body: { status: 'open' } }))}>Reopen</Button>}
            <Button size="sm" variant="ghost" onClick={() => run(() => awardsApi(`/issues/${i.id}`, { method: 'PUT', body: { verified: !i.verified } }))}>{i.verified ? 'Mark not verified' : 'Mark verified'}</Button>
            {i.status === 'closed' && <Select value={i.fixHeld == null ? '' : String(i.fixHeld)} onChange={(v) => run(() => awardsApi(`/issues/${i.id}`, { method: 'PUT', body: { fixHeld: v === '' ? null : v === 'true' } }))}
              options={[{ value: '', label: 'Fix held? (not yet known)' }, { value: 'true', label: 'Fix held' }, { value: 'false', label: 'Fix did not hold' }]} />}
          </div>
        </CardContent></Card>
      ))}
    </div>
  )
}

function SharingTab({ orgId, d, run }: { orgId: string; d: OrgData; run: Run }) {
  const [f, setF] = useState({ viewerEmail: '', level: 'summary' })
  return (
    <Card>
      <CardHeader><CardTitle>Who can see your track record</CardTitle>
        <p className="text-sm text-slate-500">Funders always see the issues on their own awards. Anyone else sees nothing unless you share here. <b>Summary</b> shows counts, time to fix and recurrence only. <b>Full</b> adds your verified issues with your responses. Unverified issues are never shared. You can stop sharing at any time.</p></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
          <Input label="Email of the person to share with" type="email" value={f.viewerEmail} onChange={(e) => setF({ ...f, viewerEmail: e.target.value })} />
          <Select label="Level" value={f.level} onChange={(level) => setF({ ...f, level })} options={[{ value: 'summary', label: 'Summary' }, { value: 'full', label: 'Full' }]} />
          <Button disabled={!f.viewerEmail.includes('@')} onClick={() => run(() => awardsApi('/shares', { method: 'PUT', body: { orgId, ...f } }).then(() => setF({ ...f, viewerEmail: '' })))}>Share</Button>
        </div>
        {d.shares.length === 0 ? <p className="text-sm text-slate-500">Not shared with anyone.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">{d.shares.map((s) => (
            <li key={s.viewerEmail} className="flex items-center justify-between py-2"><span>{s.viewerEmail} · <b>{s.level}</b></span>
              <Button size="sm" variant="ghost" onClick={() => run(() => awardsApi('/shares', { method: 'DELETE', body: { orgId, viewerEmail: s.viewerEmail } }))}>Stop sharing</Button></li>))}</ul>
        )}
      </CardContent>
    </Card>
  )
}

type FunderOrg = { orgId: string; name: string; awards: Award[]; measures: Measure[]; ownAwardIssues: IssueRow[]; shared: { level: string; trackRecord: TrackRecord; issues: IssueRow[] } | null }

function FunderView() {
  const [orgs, setOrgs] = useState<FunderOrg[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { awardsApi<{ organisations: FunderOrg[] }>('/funder').then((b) => setOrgs(b.organisations)).catch((e) => setError((e as Error).message)) }, [])
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  if (!orgs) return <p className="text-sm text-slate-500">Loading…</p>
  if (!orgs.length) return <p className="text-sm text-slate-500">No organisation has named you as the funder on an award or shared its track record with you.</p>
  return (
    <div className="space-y-4">
      {orgs.map((o) => (
        <Card key={o.orgId}>
          <CardHeader><CardTitle>{o.name}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {o.awards.length > 0 && <div className="space-y-3"><p className="font-medium">Your awards</p>{o.awards.map((a) => (
              <div key={a.id} className="rounded-lg border border-slate-200 p-3">
                <p>{a.title} · {AWARD_STATUS_LABEL[a.status]} · {o.ownAwardIssues.filter((i) => i.awardId === a.id && i.status === 'open').length} open issue(s) · {o.measures.filter((m) => m.awardId === a.id && m.status === 'active').length} active measure(s)</p>
                <MilestonesCard awardId={a.id} asFunder />
              </div>))}</div>}
            {o.shared ? (
              <div className="space-y-2"><p className="font-medium">Shared track record ({o.shared.level})</p><TrackRecordCard t={o.shared.trackRecord} />
                {o.shared.issues.length > 0 && <ul className="list-disc pl-5">{o.shared.issues.map((i) => <li key={i.id}><b>{i.title}</b> ({label(i.type)}, {i.status}){i.orgResponse && <> · their response: {i.orgResponse}</>}</li>)}</ul>}</div>
            ) : <p className="text-slate-500">The organisation has not shared its wider track record with you.</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
