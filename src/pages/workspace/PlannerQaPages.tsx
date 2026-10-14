import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { api, downloadApi, SEVERITY_STYLE, wsPath } from '../../lib/workspaceApi'
import { Badge, Button, Card, CardContent, Input, Select, Table, Tbody, Td, Th, Thead } from '../../components/ui'
import { ErrorLine, Header, State, StatusPill, Tile, useAction, useApi, ExportButtons } from './shared'

const dash = (workspaceId: string) => ({ to: '/app/workspaces/$workspaceId/dashboard', params: { workspaceId }, label: 'Dashboard' })
const opt = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }))
const PACK_NAMES: Record<string, string> = {
  GQ: 'General quality', S1: 'IFRS S1', S2: 'IFRS S2', SEC: 'SEC Nigeria', FRC: 'FRCN SRG 1', MOFI: 'MOFI-aligned governance', EC: 'Evidence and controls', JUR: 'Jurisdiction',
}

// ---------------------------------------------------------------------------------------------
// SEC Nigeria IFRS S1/S2 implementation plan generator
// ---------------------------------------------------------------------------------------------
export function SecPlannerPage({ workspaceId }: { workspaceId: string }) {
  const plan = useApi<any>(wsPath(workspaceId, '/esg-planner/sec-ng'))
  const [f, setF] = useState({ organisationName: '', entityType: 'public_company', readiness: 'early', horizon: '12m', startDate: '', firstReportingYear: '' })
  const { run, error, busy } = useAction(plan.reload)
  const s = plan.data?.settings ?? {}
  const meta = plan.data?.framework?.meta
  const generated = !!s.entityType
  const generate = (regenerate: boolean) => run(() => api(wsPath(workspaceId, '/esg-planner/sec-ng'), { method: 'POST', body: {
    ...f, regenerate, startDate: f.startDate || null, firstReportingYear: f.firstReportingYear ? Number(f.firstReportingYear) : null,
  } }))
  return (
    <div className="space-y-6">
      <Header title="IFRS S1/S2 implementation plan" subtitle="Built on the eight minimum elements in the SEC Nigeria circular. Editable, persisted, and downloadable." back={dash(workspaceId)} />
      {meta && <Card><CardContent className="space-y-1 text-sm">
        <p><b>{meta.publisher}</b> — {meta.version}. {meta.note}</p>
        <p>Plans are due <b>15 October 2026</b>. That deadline is separate from your first reporting year, which follows the FRCN Roadmap.</p>
        <a className="text-emerald-700 underline" href={meta.sourceUrl} target="_blank" rel="noreferrer">Read the SEC circular</a>
      </CardContent></Card>}
      <Card><CardContent className="grid gap-3 md:grid-cols-3">
        <Input label="Organisation name" value={f.organisationName} onChange={e => setF({ ...f, organisationName: e.target.value })} />
        <Select label="Organisation type" value={f.entityType} onChange={entityType => setF({ ...f, entityType })} options={opt([
          ['public_company', 'Public company'], ['spicmo', 'Significant public interest capital market operator'], ['sme', 'Small or medium-sized entity'], ['other', 'Other organisation / voluntary adopter'],
        ])} />
        <Select label="Current readiness" value={f.readiness} onChange={readiness => setF({ ...f, readiness })} options={opt([
          ['early', 'Early-stage — limited systems or disclosures'], ['developing', 'Developing — some policies and data'], ['advanced', 'Advanced — established reporting and controls'],
        ])} />
        <Select label="Planning horizon" value={f.horizon} onChange={horizon => setF({ ...f, horizon })} options={opt([['90d', '90-day priority plan'], ['12m', '12-month roadmap'], ['24m', '24-month roadmap']])} />
        <Input label="Plan start date (default today)" type="date" value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} />
        <Input label="First in-scope reporting year (blank = SEC/FRCN default)" type="number" value={f.firstReportingYear} onChange={e => setF({ ...f, firstReportingYear: e.target.value })} />
        <div className="flex items-end gap-2 md:col-span-3">
          <Button disabled={busy || !f.organisationName} onClick={() => generate(false)}>{generated ? 'Add missing elements' : 'Generate implementation plan'}</Button>
          {generated && <Button variant="outline" disabled={busy || !f.organisationName} onClick={() => generate(true)}>Regenerate dates and milestones (overwrites edits)</Button>}
        </div>
      </CardContent></Card>
      <ErrorLine error={error} /><State loading={plan.loading} error={plan.error} />
      {generated && <>
        <p className="text-sm text-slate-600">
          {s.organisationName} · {s.horizon} plan from {s.startDate} ·{' '}
          {s.firstReportingYear ? `first in-scope period begins on or after 1 January ${s.firstReportingYear}` : 'first reporting year not yet confirmed'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => run(() => downloadApi(wsPath(workspaceId, '/esg-planner/sec-ng/export'), 'ifrs-s1-s2-implementation-plan.doc'))}>Download Word document</Button>
          <Button variant="outline" onClick={() => run(() => downloadApi(wsPath(workspaceId, '/esg-planner/sec-ng/export?format=csv'), 'ifrs-s1-s2-implementation-plan.csv'))}>Download CSV</Button>
          <ExportButtons path={wsPath(workspaceId, '/esg-planner/sec-ng/export')} name="ifrs-s1-s2-implementation-plan" />
        </div>
      </>}
      <Table><Thead><tr><Th>#</Th><Th>Required element</Th><Th>Owner</Th><Th>Timeline</Th><Th>Milestones</Th><Th>Status</Th></tr></Thead>
        <Tbody>{plan.data?.rows?.map((r: any, i: number) => (
          <tr key={r.requirementId}>
            <Td>{i + 1}</Td>
            <Td>{r.planId
              ? <Link className="text-emerald-700 underline" to="/app/workspaces/$workspaceId/esg/implementation/$requirementId" params={{ workspaceId, requirementId: String(r.requirementDbId) }}>{r.requirementText}</Link>
              : r.requirementText}</Td>
            <Td>{r.owner ?? '—'}</Td><Td>{r.timelineStart ? `${r.timelineStart} → ${r.timelineEnd}` : '—'}</Td>
            <Td><ol className="list-decimal pl-4 text-xs">{r.milestones.map((m: any) => <li key={m.milestoneNum}>{m.description} ({m.targetDate ?? 'no date'})</li>)}</ol></Td>
            <Td><StatusPill value={r.status} /></Td>
          </tr>))}</Tbody></Table>
      <p className="text-xs text-slate-500">This plan is not legal advice, regulatory approval, assurance or a statement of IFRS S1/S2 compliance. Check the SEC and FRCN sources for later updates.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// ESG Report Quality Checklist
// ---------------------------------------------------------------------------------------------
const PROFILE_FLAGS: [string, string, (j: string) => boolean][] = [
  ['adoptingVoluntarily', 'Adopting IFRS S1/S2 voluntarily', () => true],
  ['financialActivities', 'Activities include asset management, commercial banking or insurance', () => true],
  ['secScope', 'Covered by the SEC Nigeria circular (public company / significant capital market operator)', (j) => j === 'NG'],
  ['mofiScope', 'In MOFI portfolio scope (MOFI checks become mandatory)', (j) => j === 'NG'],
  ['mofiOverlay', 'Use the MOFI-aligned governance benchmark (good practice)', (j) => j === 'NG'],
]

export function QaListPage({ workspaceId }: { workspaceId: string }) {
  const cat = useApi<any>(wsPath(workspaceId, '/qa/catalogue'))
  const list = useApi<any[]>(wsPath(workspaceId, '/qa/periods'))
  const [f, setF] = useState<Record<string, any>>({ label: '', periodStart: '', periodEnd: '', jurisdiction: 'NG', category: 'ng_pie', copyFrom: '' })
  const { run, error, busy } = useAction(list.reload)
  const jur = cat.data?.jurisdictions?.find((j: any) => j.code === f.jurisdiction)
  return (
    <div className="space-y-6">
      <Header title="ESG report quality checklist" subtitle="Reward evidence of implementation, not the mere existence of paperwork." back={dash(workspaceId)} />
      {cat.data?.legacy && !cat.data.legacy.reconciled && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        <b>Release blocker:</b> {cat.data.legacy.note}
      </p>}
      <Card><CardContent className="space-y-3">
        <h2 className="font-semibold">New reporting period</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Label (e.g. FY2028 annual report)" value={f.label} onChange={e => setF({ ...f, label: e.target.value })} />
          <Input label="Period start" type="date" value={f.periodStart} onChange={e => setF({ ...f, periodStart: e.target.value })} />
          <Input label="Period end" type="date" value={f.periodEnd} onChange={e => setF({ ...f, periodEnd: e.target.value })} />
          <Select label="Jurisdiction" value={f.jurisdiction} onChange={jurisdiction => setF({ ...f, jurisdiction, category: cat.data?.jurisdictions?.find((j: any) => j.code === jurisdiction)?.categories?.[0]?.id ?? '' })}
            options={(cat.data?.jurisdictions ?? []).map((j: any) => ({ value: j.code, label: j.name }))} />
          <div className="md:col-span-2"><Select label="Entity category" value={f.category} onChange={category => setF({ ...f, category })}
            options={(jur?.categories ?? []).map((c: any) => ({ value: c.id, label: `${c.label}${c.mandatoryFrom ? ` — mandatory from ${c.mandatoryFrom}` : ''}` }))} /></div>
        </div>
        {jur && <p className="text-xs text-slate-600">{jur.authority}. {jur.note} <a className="text-emerald-700 underline" href={jur.sourceUrl} target="_blank" rel="noreferrer">{jur.sourceTitle}</a>
          {jur.requiresVerification && <Badge className="ml-2 bg-amber-100 text-amber-800">requires verification</Badge>}</p>}
        {jur?.market && <p className="text-xs text-slate-600">
          <b>Securities regulator:</b> {jur.market.regulator ?? 'none recorded'} · <b>Exchange(s):</b> {jur.market.exchanges.join(', ') || 'none'}
          {jur.market.esgDisclosure && <> · <b>Sustainability disclosure:</b> {jur.market.esgDisclosure}</>}
          {jur.market.blocs.length > 0 && <> · <b>Blocs:</b> {jur.market.blocs.join(', ')}</>}
          {jur.market.verify.length > 0 && <> · <span className="text-amber-800">to verify: {jur.market.verify.join(', ')}</span></>}</p>}
        <div className="space-y-1">{PROFILE_FLAGS.filter(([, , show]) => show(f.jurisdiction)).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f[k]} onChange={e => setF({ ...f, [k]: e.target.checked })} /> {label}</label>))}</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-72"><Select placeholder="Start fresh" label="Carry forward owners and notes from" value={f.copyFrom} onChange={copyFrom => setF({ ...f, copyFrom })}
            options={(list.data ?? []).map((p: any) => ({ value: String(p.id), label: p.label }))} /></div>
          <Button disabled={busy || !f.label || !f.periodStart || !f.periodEnd} onClick={() => run(() => api(wsPath(workspaceId, '/qa/periods'), { method: 'POST', body: {
            label: f.label, periodStart: f.periodStart, periodEnd: f.periodEnd, copyFrom: f.copyFrom || undefined,
            profile: { jurisdiction: f.jurisdiction, category: f.category, ...Object.fromEntries(PROFILE_FLAGS.map(([k]) => [k, !!f[k]])) },
          } }))}>Create period</Button>
        </div>
      </CardContent></Card>
      <ErrorLine error={error} /><State loading={list.loading} error={list.error ?? cat.error} />
      <Table><Thead><tr><Th>Period</Th><Th>Dates</Th><Th>Jurisdiction</Th><Th>Score</Th><Th>Gate</Th><Th>Status</Th></tr></Thead>
        <Tbody>{list.data?.map((p: any) => (
          <tr key={p.id}>
            <Td><Link className="font-semibold text-emerald-700 underline" to="/app/workspaces/$workspaceId/qa/$periodId" params={{ workspaceId, periodId: String(p.id) }}>{p.label}</Link>
              {p.comparabilityWarning && <p className="text-xs text-amber-700">{p.comparabilityWarning}</p>}</Td>
            <Td>{p.periodStart} → {p.periodEnd}</Td><Td>{p.jurisdiction}</Td><Td>{p.score} · {p.band}</Td>
            <Td>{p.readyForApproval ? <Badge className="bg-emerald-100 text-emerald-700">ready</Badge> : <Badge className="bg-rose-100 text-rose-700">blocked</Badge>}</Td>
            <Td><StatusPill value={p.status} /></Td>
          </tr>))}</Tbody></Table>
    </div>
  )
}

const STATUSES: [string, string][] = [
  ['not_started', 'Not started'], ['in_progress', 'In progress'], ['pending_review', 'Pending review'], ['returned', 'Returned for more evidence'],
  ['met', 'Met'], ['partially_met', 'Partially met'], ['not_met', 'Not met'], ['blocked', 'Blocked'], ['not_applicable', 'Not applicable'],
  ['exception_approved', 'Exception approved (admins; never for mandatory checks)'],
]

export function QaPeriodPage({ workspaceId, periodId }: { workspaceId: string; periodId: string }) {
  const v = useApi<any>(wsPath(workspaceId, `/qa/periods/${periodId}`))
  const evidence = useApi<any[]>(wsPath(workspaceId, '/evidence'))
  const [flt, setFlt] = useState({ pack: '', status: '', severity: '', q: '' })
  const [open, setOpen] = useState<string | null>(null)
  const [revision, setRevision] = useState('')
  const [draft, setDraft] = useState<Record<string, any>>({})
  const { run, error, busy } = useAction(v.reload)
  const rows: any[] = useMemo(() => (v.data?.rows ?? []).filter((r: any) =>
    (!flt.pack || r.pack === flt.pack) && (!flt.status || r.status === flt.status) && (!flt.severity || r.severity === flt.severity) &&
    (!flt.q || `${r.id} ${r.title}`.toLowerCase().includes(flt.q.toLowerCase()))), [v.data, flt])
  if (!v.data) return <State loading={v.loading} error={v.error} />
  const d = v.data
  const s = d.summary
  const frozen = d.frozen
  const put = (checkId: string, body: object) => run(() => api(wsPath(workspaceId, `/qa/periods/${periodId}/checks/${encodeURIComponent(checkId)}`), { method: 'PUT', body }))
  const packs = [...new Set((d.rows as any[]).map(r => r.pack))]
  return (
    <div className="space-y-6">
      <Header title={`ESG report QA — ${d.period.label}`} subtitle={`${d.organisation} · ${d.period.periodStart} → ${d.period.periodEnd} · ${s.version}`} back={{ to: '/app/workspaces/$workspaceId/qa', params: { workspaceId }, label: 'Reporting periods' }} />
      <div role="status" className={`rounded-lg p-3 text-sm ${s.readyForApproval ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
        <b>Score {s.score}/100 — {s.band}.</b> {s.readyForApproval ? 'Ready for approval.' : `Approval blocked: ${s.blockers.join('; ')}.`}
        {frozen && <> Finalised by {d.period.approvedBy} on {new Date(d.period.approvedAt).toLocaleDateString()} — this is a frozen snapshot.</>}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Tile label="Coverage" value={`${s.coverage}%`} /><Tile label="Evidence accepted" value={`${s.evidenceAcceptance}%`} />
        <Tile label="Mandatory coverage" value={`${s.mandatoryCoverage}%`} /><Tile label="Mandatory pass rate" value={`${s.mandatoryPassRate}%`} />
        <Tile label="Open critical" value={s.criticalOpen.length} tone="text-rose-700" />
      </div>
      {d.actions && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Corrective actions" value={`${d.actions.open} open / ${d.actions.total}`} />
        <Tile label="Overdue action rate" value={d.actions.overdueRate == null ? '—' : `${d.actions.overdueRate}%`} tone="text-rose-700" />
        <Tile label="On-time completion" value={d.actions.onTimeCompletion == null ? '—' : `${d.actions.onTimeCompletion}%`} />
        <Tile label="Effectiveness pass rate" value={d.actions.effectivenessPassRate == null ? '—' : `${d.actions.effectivenessPassRate}%`} />
      </div>}
      {d.revisionOf && <p className="text-sm text-slate-600">Revised version of an earlier finalised period. Reason: {d.revisionReason}</p>}
      <Card><CardContent className="text-sm">
        <p><b>{d.jurisdiction.name}</b>: IFRS S1/S2 <StatusPill value={d.applicability.status} />{d.applicability.effectiveFrom && <> (periods beginning on or after {d.applicability.effectiveFrom})</>} · scope {d.applicability.scope.replace(/_/g, ' ')}</p>
        <p className="text-slate-600">{d.applicability.note} <a className="text-emerald-700 underline" href={d.applicability.sourceUrl} target="_blank" rel="noreferrer">{d.jurisdiction.sourceTitle}</a>
          {d.applicability.requiresVerification && <Badge className="ml-2 bg-amber-100 text-amber-800">requires verification</Badge>}</p>
        {d.legacy && !d.legacy.reconciled && <p className="mt-2 text-amber-800">General quality checks GQ-01–GQ-30 are a provisional reconstruction, not the verified original 30-check wording or weights.</p>}
      </CardContent></Card>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56"><Select placeholder="All modules" value={flt.pack} onChange={pack => setFlt({ ...flt, pack })} options={packs.map(p => ({ value: p, label: PACK_NAMES[p] ?? p }))} /></div>
        <div className="w-40"><Select placeholder="Any status" value={flt.status} onChange={status => setFlt({ ...flt, status })} options={opt(STATUSES)} /></div>
        <div className="w-36"><Select placeholder="Any severity" value={flt.severity} onChange={severity => setFlt({ ...flt, severity })} options={['critical', 'high', 'medium', 'low'].map(x => ({ value: x, label: x }))} /></div>
        <div className="w-56"><Input label="Search" value={flt.q} onChange={e => setFlt({ ...flt, q: e.target.value })} /></div>
        <Button variant="outline" onClick={() => run(() => downloadApi(wsPath(workspaceId, `/qa/periods/${periodId}/export`), `esg-report-qa-${d.period.label}.doc`))}>Word report</Button>
        <Button variant="outline" onClick={() => run(() => downloadApi(wsPath(workspaceId, `/qa/periods/${periodId}/export?format=csv`), `esg-report-qa-${d.period.label}.csv`))}>CSV</Button>
        <ExportButtons path={wsPath(workspaceId, `/qa/periods/${periodId}/export`)} name={`esg-report-qa-${d.period.label}`} />
        {!frozen && <Button disabled={busy} onClick={() => run(() => api(wsPath(workspaceId, `/qa/periods/${periodId}/finalise`), { method: 'POST', body: {} }))}>Finalise and sign off</Button>}
      </div>
      {frozen && <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[280px] flex-1"><Input label="Reason for a revised version" value={revision} onChange={e => setRevision(e.target.value)} /></div>
        <Button variant="outline" disabled={busy || !revision} onClick={() => run(() => api(wsPath(workspaceId, `/qa/periods/${periodId}/revise`), { method: 'POST', body: { reason: revision } }))}>Create revised version</Button>
      </div>}
      <ErrorLine error={error} />
      <p className="text-xs text-slate-500">Showing {rows.length} of {d.rows.length} applicable checks. Met needs linked evidence accepted by a reviewer; not applicable needs a reason and someone else’s approval; the preparer cannot give final sign-off.</p>
      <Table><Thead><tr><Th>Check</Th><Th>Class</Th><Th>Severity</Th><Th>Status</Th><Th>Evidence</Th><Th>Owner</Th><Th>Action</Th></tr></Thead>
        <Tbody>{rows.map((r: any) => (
          <tr key={r.id} className="align-top">
            <Td><b>{r.id}</b> {r.title}{r.provisional && <Badge className="ml-1 bg-amber-100 text-amber-800">provisional</Badge>}<p className="text-xs text-slate-500">{r.acceptance}</p></Td>
            <Td><span className="text-xs">{r.label}</span></Td>
            <Td><Badge className={SEVERITY_STYLE[r.severity]}>{r.severity}</Badge><p className="text-xs text-slate-500">weight {r.weight}</p></Td>
            <Td><StatusPill value={r.status} />{r.status === 'not_applicable' && <p className="text-xs">{r.naApprovedBy ? `approved by ${r.naApprovedBy}` : 'awaiting approval'}</p>}</Td>
            <Td><StatusPill value={r.evidenceState} /></Td>
            <Td>{r.owner ?? '—'}</Td>
            <Td><Button size="sm" variant="ghost" onClick={() => { setOpen(open === r.id ? null : r.id); setDraft({ status: r.status, owner: r.owner ?? '', reviewer: r.reviewer ?? '', dueDate: r.dueDate ?? '', notes: r.notes, blocker: r.blocker, naReason: r.naReason, evidenceId: r.evidenceId ? String(r.evidenceId) : '' }) }}>{open === r.id ? 'Close' : 'Open'}</Button></Td>
          </tr>))}</Tbody></Table>
      {open && (() => {
        const r = d.rows.find((x: any) => x.id === open)
        return <Card><CardContent className="space-y-3">
          <h2 className="font-semibold">{r.id} {r.title}</h2>
          <p className="text-sm text-slate-600">{r.reason} Evidence examples: {r.evidenceExamples}.</p>
          <fieldset disabled={frozen || busy} className="grid gap-3 md:grid-cols-3">
            <Select label="Status" value={draft.status} onChange={status => setDraft({ ...draft, status })} options={opt(STATUSES)} />
            <Select placeholder="No evidence linked" label="Linked evidence" value={draft.evidenceId} onChange={evidenceId => setDraft({ ...draft, evidenceId })}
              options={(evidence.data ?? []).map((e: any) => ({ value: String(e.id), label: `${e.documentName} (${e.status})` }))} />
            <Input label="Owner" value={draft.owner} onChange={e => setDraft({ ...draft, owner: e.target.value })} />
            <Input label="Reviewer" value={draft.reviewer} onChange={e => setDraft({ ...draft, reviewer: e.target.value })} />
            <Input label="Due date" type="date" value={draft.dueDate} onChange={e => setDraft({ ...draft, dueDate: e.target.value })} />
            <Input label="Notes / unmet criteria" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
            {draft.status === 'blocked' && <Input label="Blocker, owner and escalation date" value={draft.blocker} onChange={e => setDraft({ ...draft, blocker: e.target.value })} />}
            {draft.status === 'not_applicable' && <Input label="Applicability rationale" value={draft.naReason} onChange={e => setDraft({ ...draft, naReason: e.target.value })} />}
          </fieldset>
          {!frozen && <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => put(r.id, { ...draft, dueDate: draft.dueDate || null, evidenceId: draft.evidenceId ? Number(draft.evidenceId) : null, naReason: draft.status === 'not_applicable' ? draft.naReason : undefined })}>Save</Button>
            {r.status === 'not_applicable' && !r.naApprovedBy && <Button variant="outline" onClick={() => run(() => api(wsPath(workspaceId, `/qa/periods/${periodId}/checks/${encodeURIComponent(r.id)}/approve-na`), { method: 'POST', body: {} }))}>Approve not applicable</Button>}
            {r.status !== 'met' && <Button variant="outline" onClick={() => run(() => api(wsPath(workspaceId, `/qa/periods/${periodId}/checks/${encodeURIComponent(r.id)}/cap`), { method: 'POST', body: {} }))}>Raise corrective action</Button>}
          </div>}
        </CardContent></Card>
      })()}
    </div>
  )
}
