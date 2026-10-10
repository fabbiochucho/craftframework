import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { api, SEVERITY_STYLE, wsPath } from '../../lib/workspaceApi'
import { Accordion, Badge, Button, Card, CardContent, Input, ProgressBar, Select, Table, Tbody, Td, Th, Thead } from '../../components/ui'
import { ErrorLine, Header, State, StatusPill, Tile, useAction, useApi } from './shared'

const dash = (workspaceId: string) => ({ to: '/app/workspaces/$workspaceId/dashboard', params: { workspaceId }, label: 'Dashboard' })

export function EsgFrameworksPage({ workspaceId }: { workspaceId: string }) {
  const [jur, setJur] = useState('')
  const list = useApi<any[]>(wsPath(workspaceId, `/esg-frameworks${jur ? `?jurisdiction=${encodeURIComponent(jur)}` : ''}`))
  const { run, error } = useAction(list.reload)
  return (
    <div className="space-y-6">
      <Header title="ESG frameworks" back={dash(workspaceId)} />
      <div className="w-48"><Select placeholder="All jurisdictions" value={jur} onChange={setJur} options={['EU', 'global'].map(v => ({ value: v, label: v }))} /></div>
      <ErrorLine error={error} /><State loading={list.loading} error={list.error} />
      <div className="grid gap-4 md:grid-cols-3">{list.data?.map(f => (
        <Card key={f.id}><CardContent className="space-y-2">
          <p className="text-lg font-bold text-emerald-900">{f.frameworkName}</p>
          <p className="text-sm text-slate-500">{f.jurisdiction} · applies to {f.applicability === 'all' ? 'all entities' : 'specific sectors'}</p>
          {f.adoptionStatus === 'adopted' ? <StatusPill value="approved" /> : <Button size="sm" onClick={() => run(() => api(wsPath(workspaceId, `/esg-frameworks/${f.id}/adopt`), { method: 'POST', body: {} }))}>Adopt</Button>}
        </CardContent></Card>))}</div>
      <Link className="text-sm text-emerald-700 underline" to="/app/workspaces/$workspaceId/esg/requirements" params={{ workspaceId }}>View requirements →</Link>
    </div>
  )
}

export function EsgRequirementsPage({ workspaceId }: { workspaceId: string }) {
  const list = useApi<any[]>(wsPath(workspaceId, '/esg-requirements'))
  const { run, error } = useAction(list.reload)
  return (
    <div className="space-y-6">
      <Header title="ESG requirements" subtitle="Requirements of adopted frameworks" back={dash(workspaceId)} />
      <ErrorLine error={error} /><State loading={list.loading} error={list.error} />
      <Table><Thead><tr><Th>Framework</Th><Th>Requirement</Th><Th>Category</Th><Th>Priority</Th><Th>Deadline</Th><Th>Implementation</Th></tr></Thead>
        <Tbody>{list.data?.map(r => (
          <tr key={r.id}><Td>{r.frameworkName}</Td><Td><b>{r.requirementId}</b> {r.requirementText}</Td><Td>{r.category}</Td>
            <Td><Badge className={SEVERITY_STYLE[r.priority] ?? ''}>{r.priority}</Badge></Td><Td>{r.implementationDeadline ?? '—'}</Td>
            <Td>{r.plan
              ? <Link className="text-emerald-700 underline" to="/app/workspaces/$workspaceId/esg/implementation/$requirementId" params={{ workspaceId, requirementId: String(r.id) }}><StatusPill value={r.plan.status} /></Link>
              : <Button size="sm" variant="outline" onClick={() => run(() => api(wsPath(workspaceId, `/esg-requirements/${r.id}/create-plan`), { method: 'POST', body: {} }))}>Create plan</Button>}</Td></tr>))}</Tbody></Table>
    </div>
  )
}

export function EsgRoadmapPage({ workspaceId }: { workspaceId: string }) {
  const rm = useApi<any>(wsPath(workspaceId, '/esg-roadmap'))
  const items: any[] = rm.data?.items ?? []
  const dates = items.flatMap(i => [i.start, i.end ?? i.deadline].filter(Boolean)).map((d: string) => new Date(d).getTime())
  const min = dates.length ? Math.min(...dates) : 0
  const span = dates.length ? Math.max(Math.max(...dates) - min, 86_400_000) : 1
  return (
    <div className="space-y-6">
      <Header title="ESG roadmap" back={dash(workspaceId)} />
      <State loading={rm.loading} error={rm.error} />
      <div className="grid gap-3 md:grid-cols-3">{Object.entries(rm.data?.byCategory ?? {}).map(([k, v]: any) => <Tile key={k} label={`${k} (${v.total})`} value={`${v.percent}%`} />)}</div>
      <div className="space-y-2">{items.map(i => {
        const start = i.start ? new Date(i.start).getTime() : min
        const end = new Date(i.end ?? i.deadline ?? start).getTime()
        return (
          <div key={i.planId} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-medium">{i.requirementId} — {i.text} <span className="text-slate-400">({i.percentComplete}%)</span></p>
            <div className="relative mt-2 h-3 rounded bg-slate-100">
              <div className="absolute h-3 rounded bg-emerald-500" style={{ left: `${((start - min) / span) * 100}%`, width: `${Math.max(((end - start) / span) * 100, 2)}%` }} />
            </div>
          </div>)
      })}</div>
    </div>
  )
}

export function EsgPlanPage({ workspaceId, requirementId }: { workspaceId: string; requirementId: string }) {
  const rm = useApi<any>(wsPath(workspaceId, '/esg-requirements'))
  const { run, error } = useAction(rm.reload)
  const req = rm.data?.find((r: any) => String(r.id) === requirementId)
  const [owner, setOwner] = useState<string | null>(null)
  if (!req) return <State loading={rm.loading} error={rm.error ?? (rm.data ? 'Requirement not found' : null)} />
  const plan = req.plan
  if (!plan) return <p className="text-sm text-slate-500">No plan yet — create one from the requirements list.</p>
  const update = (body: object) => run(() => api(wsPath(workspaceId, `/esg-plans/${plan.id}`), { method: 'PUT', body }))
  return (
    <div className="max-w-2xl space-y-4">
      <Header title={`${req.requirementId} implementation`} subtitle={req.requirementText} back={{ to: '/app/workspaces/$workspaceId/esg/requirements', params: { workspaceId }, label: 'Requirements' }} />
      <ErrorLine error={error} />
      <Select label="Status" value={plan.status} onChange={status => update({ status })} options={['not_started', 'in_progress', 'completed'].map(v => ({ value: v, label: v.replace('_', ' ') }))} />
      <Input label="Owner" value={owner ?? plan.owner ?? ''} onChange={e => setOwner(e.target.value)} onBlur={() => owner !== null && update({ owner })} />
      <Card><CardContent className="space-y-1 text-sm">{[plan.milestone1, plan.milestone2, plan.milestone3].map((m, i) => <p key={i}>Milestone {i + 1}: {m ?? '—'}</p>)}<p>Evidence items: {plan.evidenceCount}</p></CardContent></Card>
    </div>
  )
}

export function CapHubPage({ workspaceId }: { workspaceId: string }) {
  const [flt, setFlt] = useState({ status: '', severity: '', due_date: '' })
  const qs = Object.entries(flt).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  const list = useApi<any[]>(wsPath(workspaceId, `/cap${qs ? `?${qs}` : ''}`))
  const sum = useApi<any>(wsPath(workspaceId, '/cap/summary'))
  const [f, setF] = useState({ findingDescription: '', severity: 'medium', dueDate: '' })
  const { run, error } = useAction(async () => { await list.reload(); await sum.reload() })
  const opt = (a: string[]) => a.map(v => ({ value: v, label: v.replace('_', ' ') }))
  return (
    <div className="space-y-6">
      <Header title="Corrective actions" back={dash(workspaceId)} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Open" value={sum.data?.open ?? '–'} /><Tile label="Overdue" value={sum.data?.overdue ?? '–'} tone="text-rose-700" />
        <Tile label="% complete" value={`${sum.data?.percentComplete ?? 0}%`} /><Tile label="Avg days to close" value={sum.data?.avgDaysToClose ?? '–'} />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="w-40"><Select placeholder="Any status" value={flt.status} onChange={status => setFlt({ ...flt, status })} options={opt(['open', 'in_progress', 'completed', 'overdue'])} /></div>
        <div className="w-40"><Select placeholder="Any severity" value={flt.severity} onChange={severity => setFlt({ ...flt, severity })} options={opt(['critical', 'high', 'medium', 'low'])} /></div>
        <div className="w-40"><Select placeholder="Any due date" value={flt.due_date} onChange={due_date => setFlt({ ...flt, due_date })} options={opt(['overdue', 'this_week', 'this_month', 'later'])} /></div>
      </div>
      <Accordion title="New manual CAP">
        <div className="flex flex-wrap items-end gap-3 p-3">
          <div className="min-w-[240px] flex-1"><Input label="Finding" value={f.findingDescription} onChange={e => setF({ ...f, findingDescription: e.target.value })} /></div>
          <div className="w-36"><Select label="Severity" value={f.severity} onChange={severity => setF({ ...f, severity })} options={opt(['critical', 'high', 'medium', 'low'])} /></div>
          <div className="w-44"><Input label="Due" type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} /></div>
          <Button disabled={!f.findingDescription} onClick={() => run(() => api(wsPath(workspaceId, '/cap'), { method: 'POST', body: { ...f, dueDate: f.dueDate || null } }))}>Create</Button>
        </div>
      </Accordion>
      <ErrorLine error={error} /><State loading={list.loading} error={list.error} />
      <Table><Thead><tr><Th>Source</Th><Th>Finding</Th><Th>Severity</Th><Th>Owner</Th><Th>Due</Th><Th>Status</Th></tr></Thead>
        <Tbody>{list.data?.map(c => (
          <tr key={c.id}><Td>{c.sourceType.replace('_', ' ')}</Td>
            <Td><Link className="text-emerald-700 underline" to="/app/workspaces/$workspaceId/actions/$capId" params={{ workspaceId, capId: String(c.id) }}>{c.findingDescription}</Link></Td>
            <Td><Badge className={SEVERITY_STYLE[c.severity]}>{c.severity}</Badge></Td><Td>{c.assignedTo ?? '—'}</Td><Td>{c.dueDate ?? '—'}</Td><Td><StatusPill value={c.status} /></Td></tr>))}</Tbody></Table>
    </div>
  )
}

export function CapDetailPage({ workspaceId, capId }: { workspaceId: string; capId: string }) {
  const cap = useApi<any>(wsPath(workspaceId, `/cap/${capId}`))
  const [a, setA] = useState({ actionDescription: '', owner: '', targetDate: '' })
  const { run, error } = useAction(cap.reload)
  if (!cap.data) return <State loading={cap.loading} error={cap.error} />
  const c = cap.data
  const closed = c.status === 'completed'
  const put = (id: number, body: object) => run(() => api(wsPath(workspaceId, `/cap/${capId}/actions/${id}`), { method: 'PUT', body }))
  return (
    <div className="space-y-6">
      <Header title={c.findingDescription} back={{ to: '/app/workspaces/$workspaceId/actions', params: { workspaceId }, label: 'Corrective actions' }} />
      <p className="flex items-center gap-2 text-sm"><StatusPill value={c.status} /><Badge className={SEVERITY_STYLE[c.severity]}>{c.severity}</Badge> due {c.dueDate ?? '—'} · owner {c.assignedTo ?? 'unassigned'}</p>
      <ErrorLine error={error} />
      <Accordion title="Source">{<p className="p-3 text-sm">{c.sourceType.replace('_', ' ')} {c.sourceId ?? ''}</p>}</Accordion>
      <Accordion title={`Action plan (${c.actions.length})`}>
        <div className="space-y-2 p-3">
          {c.actions.map((x: any) => (
            <div key={x.id} className="flex flex-wrap items-center gap-3 rounded border border-slate-200 p-2 text-sm">
              <span className="flex-1">{x.sequenceNum}. {x.actionDescription} <span className="text-slate-400">({x.owner ?? 'no owner'}, {x.targetDate ?? 'no date'})</span></span>
              <StatusPill value={x.status} />{x.verifiedBy && <Badge className="bg-emerald-100 text-emerald-700">verified</Badge>}
              {!closed && <><Button size="sm" variant="outline" onClick={() => put(x.id, { status: 'completed' })}>Mark complete</Button>
                <Button size="sm" variant="ghost" onClick={() => { const id = prompt('Evidence ID to link'); if (id && Number.isInteger(Number(id))) void put(x.id, { evidenceId: Number(id) }) }}>Link evidence</Button>
                <Button size="sm" variant="ghost" onClick={() => put(x.id, { verify: true })}>Verify</Button></>}
            </div>))}
          {!closed && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1"><Input label="New action" value={a.actionDescription} onChange={e => setA({ ...a, actionDescription: e.target.value })} /></div>
              <div className="w-48"><Input label="Owner" value={a.owner} onChange={e => setA({ ...a, owner: e.target.value })} /></div>
              <div className="w-44"><Input label="Target" type="date" value={a.targetDate} onChange={e => setA({ ...a, targetDate: e.target.value })} /></div>
              <Button disabled={!a.actionDescription} onClick={() => run(() => api(wsPath(workspaceId, `/cap/${capId}/actions`), { method: 'POST', body: { ...a, targetDate: a.targetDate || null } }))}>Add action</Button>
            </div>)}
        </div>
      </Accordion>
      <Accordion title="Action history (audit trail)"><ul className="space-y-1 p-3 text-xs text-slate-600">{c.history.map((h: any) => <li key={h.id}>{new Date(h.timestamp).toLocaleString()} — {h.actorId}: {h.event} {h.newValue ?? ''}</li>)}</ul></Accordion>
      <Accordion title={`Related evidence (${c.evidenceLinks.length})`}><ul className="p-3 text-sm">{c.evidenceLinks.map((l: any) => <li key={l.id}><Link className="text-emerald-700 underline" to="/app/workspaces/$workspaceId/evidence/$evidenceId" params={{ workspaceId, evidenceId: String(l.evidenceId) }}>Evidence #{l.evidenceId}</Link> ({l.linkType})</li>)}</ul></Accordion>
      {!closed && <Button onClick={() => run(() => api(wsPath(workspaceId, `/cap/${capId}/close`), { method: 'POST', body: {} }))}>Close CAP (requires verified evidence)</Button>}
      <ProgressBar value={c.actions.length ? (c.actions.filter((x: any) => x.status === 'completed').length / c.actions.length) * 100 : 0} />
    </div>
  )
}
