import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Bar, BarChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { api, SEVERITY_STYLE, TIER_LABEL, wsPath } from '../../lib/workspaceApi'
import { ALL_DOMAINS, GOVERNANCE_DOMAINS } from '../../lib/governanceDomains'
import { Badge, Button, Card, CardContent, Input, Select, Table, Tbody, Td, Th, Thead, Tabs } from '../../components/ui'
import { EditFields, ErrorLine, Header, State, StatusPill, useAction, useApi } from './shared'

export function AssessmentsListPage({ workspaceId }: { workspaceId: string }) {
  const list = useApi<any[]>(wsPath(workspaceId, '/assessments'))
  const [type, setType] = useState('G2G')
  const { run, error, busy } = useAction(list.reload)
  return (
    <div className="space-y-6">
      <Header title="Governance assessments" subtitle="All framework labels use the same shared governance-domain scoring. ISO and COSO labels are organizational tags, not specialized rubrics or certifications." back={{ to: '/app/workspaces/$workspaceId/dashboard', params: { workspaceId }, label: 'Dashboard' }} />
      <div className="flex items-end gap-3">
        <div className="w-40"><Select label="Framework" value={type} onChange={setType} options={['G2G', 'ISO', 'COSO'].map(v => ({ value: v, label: v }))} /></div>
        <Button disabled={busy} onClick={() => run(() => api(wsPath(workspaceId, '/assessments'), { method: 'POST', body: { assessmentType: type } }))}>New assessment</Button>
      </div>
      <ErrorLine error={error} />
      <State loading={list.loading} error={list.error} />
      <Table>
        <Thead><tr><Th>Type</Th><Th>Version</Th><Th>Status</Th><Th>Findings</Th><Th>Started</Th></tr></Thead>
        <Tbody>{list.data?.map(a => (
          <tr key={a.id}>
            <Td><Link className="font-semibold text-emerald-700 underline" to="/app/workspaces/$workspaceId/governance/assessments/$assessmentId" params={{ workspaceId, assessmentId: String(a.id) }}>{a.assessmentType}</Link></Td>
            <Td>v{a.version}</Td><Td><StatusPill value={a.status} /></Td><Td>{a.findingsCount}</Td><Td>{new Date(a.startedAt).toLocaleDateString()}</Td>
          </tr>))}</Tbody>
      </Table>
    </div>
  )
}

function ScoringWizard({ workspaceId, a, reload }: { workspaceId: string; a: any; reload: () => void }) {
  const locked = a.status !== 'draft'
  const [pillar, setPillar] = useState(Object.keys(GOVERNANCE_DOMAINS)[0])
  const [draft, setDraft] = useState<Record<string, number>>({})
  const { run, error } = useAction(reload)
  const byKey = new Map<string, any>(a.scores.map((s: any) => [`${s.pillar}|${s.domain}`, s]))
  const save = (domain: string, score: number, evidence: boolean) =>
    run(() => api(wsPath(workspaceId, `/assessments/${a.id}/scores/${encodeURIComponent(pillar)}/${encodeURIComponent(domain)}`), { method: 'PUT', body: { score, evidenceUploaded: evidence } }))
  return (
    <div className="space-y-4">
      <Tabs tabs={Object.keys(GOVERNANCE_DOMAINS).map(p => ({ id: p, label: p }))} active={pillar} onChange={setPillar} />
      {locked && <p className="rounded bg-blue-50 p-2 text-sm text-blue-700">This assessment is locked ({a.status.replace('_', ' ')}).</p>}
      <ErrorLine error={error} />
      {GOVERNANCE_DOMAINS[pillar].map(domain => {
        const saved = byKey.get(`${pillar}|${domain}`)
        const value = draft[domain] ?? (saved ? saved.tierLevel : 0)
        return (
          <Card key={domain}><CardContent className="flex flex-wrap items-center gap-4">
            <span className="w-56 font-medium text-slate-800">{domain}</span>
            <input type="range" min={0} max={5} step={1} value={value} disabled={locked} aria-label={`${domain} score`}
              onChange={e => setDraft({ ...draft, [domain]: Number(e.target.value) })} className="flex-1" />
            <Badge className="bg-emerald-100 text-emerald-800">{value === 0 ? 'Not scored' : TIER_LABEL(value)}</Badge>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" disabled={locked} checked={!!saved?.evidenceUploaded} onChange={e => save(domain, value, e.target.checked)} /> Evidence
            </label>
            <Button size="sm" disabled={locked} onClick={() => save(domain, value, !!saved?.evidenceUploaded)}>Save</Button>
          </CardContent></Card>
        )
      })}
    </div>
  )
}

function FindingsTab({ workspaceId, a, reload }: { workspaceId: string; a: any; reload: () => void }) {
  const [f, setF] = useState({ domain: ALL_DOMAINS[0].domain, severity: 'medium', description: '', sensitive: false, ownerAssignment: '', dueDate: '', recommendation: '', evidenceLink: '' })
  const { run, error } = useAction(reload)
  const locked = a.status === 'approved'
  return (
    <div className="space-y-4">
      {!locked && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-60"><Select label="Domain" value={f.domain} onChange={domain => setF({ ...f, domain })} options={ALL_DOMAINS.map(d => ({ value: d.domain, label: d.domain }))} /></div>
          <div className="w-36"><Select label="Severity" value={f.severity} onChange={severity => setF({ ...f, severity })} options={['critical', 'high', 'medium', 'low'].map(v => ({ value: v, label: v }))} /></div>
          <div className="min-w-[240px] flex-1"><Input label="Description" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
          <Input label="Owner assignment" value={f.ownerAssignment} onChange={e => setF({ ...f, ownerAssignment: e.target.value })} />
          <Input label="Finding due date" type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} />
          <Input label="Recommendation" value={f.recommendation} onChange={e => setF({ ...f, recommendation: e.target.value })} />
          <Input label="Evidence reference" value={f.evidenceLink} onChange={e => setF({ ...f, evidenceLink: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.sensitive} onChange={e => setF({ ...f, sensitive: e.target.checked })} /> Contains sensitive personal details</label>
          <Button disabled={!f.description} onClick={() => run(() => api(wsPath(workspaceId, `/assessments/${a.id}/findings`), { method: 'POST', body: { ...f, dueDate: f.dueDate || null } }))}>Add finding</Button>
        </div>
      )}
      <ErrorLine error={error} />
      <Table>
        <Thead><tr><Th>Domain</Th><Th>Severity</Th><Th>Description</Th><Th>Owner</Th><Th>Due</Th><Th>Status</Th></tr></Thead>
        <Tbody>{a.findings.map((x: any) => (
          <tr key={x.id}>
            <Td>{x.domain}</Td><Td><Badge className={SEVERITY_STYLE[x.severity]}>{x.severity}</Badge></Td><Td>{x.description}</Td>
            <Td>{x.ownerAssignment ?? '—'}</Td><Td>{x.dueDate ?? '—'}</Td>
            <Td>
              <select aria-label="Finding status" disabled={locked} value={x.status} className="rounded border border-slate-300 text-xs"
                onChange={e => run(() => api(wsPath(workspaceId, `/assessments/${a.id}/findings/${x.id}`), { method: 'PUT', body: { status: e.target.value } }))}>
                {['open', 'in_progress', 'resolved'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </Td>
          </tr>))}</Tbody>
      </Table>
      {a.findings.map((x: any) => <Card key={x.id}><CardContent className="space-y-3">
        <h3 className="font-semibold">Finding #{x.id} details</h3>
        <EditFields initial={x} disabled={locked} fields={[
          { name: 'ownerAssignment', label: 'Owner assignment' }, { name: 'dueDate', label: 'Due date', type: 'date' },
          { name: 'recommendation', label: 'Recommendation' }, { name: 'evidenceLink', label: 'Evidence reference' },
        ]} save={async body => { await api(wsPath(workspaceId, `/assessments/${a.id}/findings/${x.id}`), { method: 'PUT', body }); reload() }} />
      </CardContent></Card>)}
    </div>
  )
}

function ScorecardTab({ workspaceId, assessmentId }: { workspaceId: string; assessmentId: string }) {
  const sc = useApi<any>(wsPath(workspaceId, `/assessments/${assessmentId}/scorecard`))
  if (!sc.data) return <State loading={sc.loading} error={sc.error} />
  const radar = ALL_DOMAINS.map(d => ({ domain: d.domain, tier: sc.data.domains.find((x: any) => x.domain === d.domain)?.tier ?? 0 }))
  const bars = Object.entries(sc.data.pillars).map(([pillar, v]: any) => ({ pillar, tier: Math.round(v.avgTier * 10) / 10 }))
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Overall: <b>{sc.data.overallTier.toFixed(1)}</b> · Risk classification: <Badge className="bg-amber-100 text-amber-800">{sc.data.risk ?? 'Not scored'}</Badge></p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent><div className="h-80"><ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radar}><PolarGrid /><PolarAngleAxis dataKey="domain" tick={{ fontSize: 9 }} /><Radar dataKey="tier" stroke="#059669" fill="#10b981" fillOpacity={0.4} /></RadarChart>
        </ResponsiveContainer></div></CardContent></Card>
        <Card><CardContent><div className="h-80"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="pillar" tick={{ fontSize: 11 }} /><YAxis domain={[0, 5]} /><Bar dataKey="tier" fill="#10b981" /></BarChart>
        </ResponsiveContainer></div></CardContent></Card>
      </div>
      <p className="text-sm text-slate-600">Open findings — {Object.entries(sc.data.findingsBySeverity).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
    </div>
  )
}

export function AssessmentDetailPage({ workspaceId, assessmentId, review = false }: { workspaceId: string; assessmentId: string; review?: boolean }) {
  const a = useApi<any>(wsPath(workspaceId, `/assessments/${assessmentId}`))
  const [tab, setTab] = useState(review ? 'review' : 'overview')
  const [comments, setComments] = useState('')
  const { run, error } = useAction(a.reload)
  if (!a.data) return <State loading={a.loading} error={a.error} />
  const d = a.data
  const tabs = [{ id: 'overview', label: 'Overview' }, { id: 'wizard', label: 'Scoring Wizard' }, { id: 'findings', label: 'Findings' }, { id: 'scorecard', label: 'Scorecard' }, ...(review ? [{ id: 'review', label: 'Review' }] : [])]
  const act = (what: string) => run(() => api(wsPath(workspaceId, `/assessments/${assessmentId}/${what}`), { method: 'POST', body: { comments } }))
  return (
    <div className="space-y-6">
      <Header title={`${d.assessmentType} assessment v${d.version}`} subtitle="Shared governance-domain scoring — not a specialized ISO/COSO rubric or certification." back={{ to: '/app/workspaces/$workspaceId/governance/assessments', params: { workspaceId }, label: 'Assessments' }} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <ErrorLine error={error} />
      {tab === 'overview' && (
        <Card><CardContent className="space-y-2 text-sm">
          <p>Status: <StatusPill value={d.status} /></p><p>Created by {d.createdBy}</p><p>Started {new Date(d.startedAt).toLocaleString()}</p>
          <p>Completed {d.completedAt ? new Date(d.completedAt).toLocaleString() : '—'}</p><p>{d.findingsCount} finding(s) · {d.scores.length}/{ALL_DOMAINS.length} domains scored</p>
          {d.status === 'draft' && <Button onClick={() => act('submit')}>Submit for review</Button>}
          <p><Link className="text-emerald-700 underline" to="/app/workspaces/$workspaceId/governance/assessments/$assessmentId/review" params={{ workspaceId, assessmentId }}>Admin review mode</Link></p>
        </CardContent></Card>
      )}
      {tab === 'wizard' && <ScoringWizard workspaceId={workspaceId} a={d} reload={a.reload} />}
      {tab === 'findings' && <FindingsTab workspaceId={workspaceId} a={d} reload={a.reload} />}
      {tab === 'scorecard' && <ScorecardTab workspaceId={workspaceId} assessmentId={assessmentId} />}
      {tab === 'review' && (
        <Card><CardContent className="space-y-3">
          <p className="text-sm text-slate-600">Status: <StatusPill value={d.status} />. Edits are locked while in review. Approval requires the admin role and a reviewer other than the creator.</p>
          <Input label="Comments" value={comments} onChange={e => setComments(e.target.value)} />
          <div className="flex gap-2"><Button disabled={d.status !== 'in_review'} onClick={() => act('approve')}>Approve</Button>
            <Button variant="destructive" disabled={d.status !== 'in_review'} onClick={() => act('reject')}>Return to draft</Button></div>
        </CardContent></Card>
      )}
    </div>
  )
}
