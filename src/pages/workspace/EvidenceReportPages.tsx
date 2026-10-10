import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { api, wsPath } from '../../lib/workspaceApi'
import { Badge, Button, Card, CardContent, Input, Select, Table, Tbody, Td, Th, Thead } from '../../components/ui'
import { ErrorLine, Header, State, StatusPill, Tile, useAction, useApi } from './shared'

const dash = (workspaceId: string) => ({ to: '/app/workspaces/$workspaceId/dashboard', params: { workspaceId }, label: 'Dashboard' })
const ACCEPT = '.pdf,.docx,.xlsx,.zip,image/*'

export function EvidencePage({ workspaceId }: { workspaceId: string }) {
  const [flt, setFlt] = useState({ type: '', status: '' })
  const qs = Object.entries(flt).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('&')
  const list = useApi<any[]>(wsPath(workspaceId, `/evidence${qs ? `?${qs}` : ''}`))
  const [docType, setDocType] = useState('evidence')
  const [expiry, setExpiry] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const { run, error } = useAction(list.reload)
  const upload = (file: File) => {
    const form = new FormData()
    form.set('file', file); form.set('documentType', docType); if (expiry) form.set('expiryDate', expiry)
    return run(() => api(wsPath(workspaceId, '/evidence/upload'), { method: 'POST', form }))
  }
  const expired = list.data?.filter(e => e.expiryState === 'expired') ?? []
  const expiring = list.data?.filter(e => e.expiryState === 'expiring') ?? []
  const opt = (a: string[]) => a.map(v => ({ value: v, label: v.replace('_', ' ') }))
  return (
    <div className="space-y-6">
      <Header title="Evidence registry" back={dash(workspaceId)} />
      {expired.length > 0 && <p role="alert" className="rounded bg-rose-100 p-3 text-sm text-rose-800">{expired.length} document(s) have expired.</p>}
      {expiring.length > 0 && <p className="rounded bg-yellow-100 p-3 text-sm text-yellow-800">{expiring.length} document(s) expire within 30 days.</p>}
      <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void upload(f) }}
        className="flex flex-wrap items-end gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white p-4">
        <p className="text-sm text-slate-500">Drag a file here (PDF, DOCX, XLSX, image, ZIP — max 10 MB) or</p>
        <div className="w-40"><Select value={docType} onChange={setDocType} options={opt(['assessment', 'policy', 'evidence', 'certification'])} /></div>
        <div className="w-44"><Input type="date" aria-label="Expiry date" value={expiry} onChange={e => setExpiry(e.target.value)} /></div>
        <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f) }} />
        <Button onClick={() => input.current?.click()}>Choose file</Button>
      </div>
      <div className="flex gap-3">
        <div className="w-44"><Select placeholder="Any type" value={flt.type} onChange={type => setFlt({ ...flt, type })} options={opt(['assessment', 'policy', 'evidence', 'certification'])} /></div>
        <div className="w-44"><Select placeholder="Any status" value={flt.status} onChange={status => setFlt({ ...flt, status })} options={opt(['pending_review', 'approved', 'rejected', 'expired'])} /></div>
      </div>
      <ErrorLine error={error} /><State loading={list.loading} error={list.error} />
      <Table><Thead><tr><Th>File</Th><Th>Type</Th><Th>Uploaded</Th><Th>Expiry</Th><Th>Status</Th></tr></Thead>
        <Tbody>{list.data?.map(e => (
          <tr key={e.id}><Td><Link className="text-emerald-700 underline" to="/app/workspaces/$workspaceId/evidence/$evidenceId" params={{ workspaceId, evidenceId: String(e.id) }}>{e.documentName}</Link></Td>
            <Td>{e.documentType}</Td><Td>{new Date(e.uploadedAt).toLocaleDateString()}</Td><Td>{e.expiryDate ?? '—'}</Td><Td><StatusPill value={e.status} /></Td></tr>))}</Tbody></Table>
    </div>
  )
}

export function EvidenceDetailPage({ workspaceId, evidenceId }: { workspaceId: string; evidenceId: string }) {
  const ev = useApi<any>(wsPath(workspaceId, `/evidence/${evidenceId}`))
  const [comments, setComments] = useState('')
  const { run, error } = useAction(ev.reload)
  if (!ev.data) return <State loading={ev.loading} error={ev.error} />
  const e = ev.data
  const review = (status: string) => run(() => api(wsPath(workspaceId, `/evidence/${evidenceId}/approve`), { method: 'POST', body: { status, comments } }))
  return (
    <div className="max-w-3xl space-y-4">
      <Header title={e.documentName} back={{ to: '/app/workspaces/$workspaceId/evidence', params: { workspaceId }, label: 'Registry' }} />
      <Card><CardContent className="space-y-1 text-sm">
        <p>Type: {e.documentType} · {e.mimeType} · {e.fileSizeKb} KB</p><p>Uploaded by {e.uploadedBy} on {new Date(e.uploadedAt).toLocaleString()}</p>
        <p>Expiry: {e.expiryDate ?? '—'} {e.expiryState === 'expired' && <Badge className="bg-rose-100 text-rose-700">expired</Badge>}</p><p>Status: <StatusPill value={e.status} /></p>
        <a className="text-emerald-700 underline" href={`/api${wsPath(workspaceId, `/evidence/${evidenceId}/download`)}`}>Download</a>
      </CardContent></Card>
      <ErrorLine error={error} />
      <Card><CardContent className="space-y-2"><p className="text-sm font-semibold">Approval workflow</p>
        <Input label="Reviewer comments" value={comments} onChange={x => setComments(x.target.value)} />
        <div className="flex gap-2"><Button onClick={() => review('approved')}>Approve</Button><Button variant="destructive" onClick={() => review('rejected')}>Reject</Button></div>
        <ul className="text-xs text-slate-600">{e.approvals.map((a: any) => <li key={a.id}>{new Date(a.reviewDate).toLocaleDateString()} — {a.reviewerId}: {a.status} {a.comments}</li>)}</ul></CardContent></Card>
      <Card><CardContent><p className="text-sm font-semibold">Linked to</p><ul className="text-sm">{e.links.map((l: any) => <li key={l.id}>{l.targetType} #{l.targetId} ({l.linkType})</li>)}</ul></CardContent></Card>
    </div>
  )
}

const REPORT_TYPES = [['governance-scorecard', 'Governance Scorecard'], ['esg-status', 'ESG Status'], ['cap-summary', 'CAP Summary'], ['audit-trail', 'Audit Trail']]

export function ReportsPage({ workspaceId }: { workspaceId: string }) {
  const list = useApi<any[]>(wsPath(workspaceId, '/reports'))
  const schedules = useApi<any[]>(wsPath(workspaceId, '/reports/schedules'))
  const [type, setType] = useState('governance-scorecard')
  const [cadence, setCadence] = useState('weekly')
  const [recipients, setRecipients] = useState('')
  const [format, setFormat] = useState('pdf')
  const { run, error } = useAction(async () => { await list.reload(); await schedules.reload() })
  return (
    <div className="space-y-6">
      <Header title="Reports" back={dash(workspaceId)} />
      <div className="flex items-end gap-3">
        <div className="w-64"><Select label="Report type" value={type} onChange={setType} options={REPORT_TYPES.map(([value, label]) => ({ value, label }))} /></div>
        <Button onClick={() => run(() => api(wsPath(workspaceId, `/reports/${type}`), { method: 'POST', body: {} }))}>Generate</Button>
        <Link className="text-sm text-emerald-700 underline" to="/app/workspaces/$workspaceId/compliance-dashboard" params={{ workspaceId }}>Compliance dashboard</Link>
      </div>
      <ErrorLine error={error} /><State loading={list.loading} error={list.error} />
      <Table><Thead><tr><Th>Type</Th><Th>As of</Th><Th>Generated by</Th></tr></Thead>
        <Tbody>{list.data?.map(r => <tr key={r.id}><Td><Link className="text-emerald-700 underline" to="/app/workspaces/$workspaceId/reports/$reportId" params={{ workspaceId, reportId: String(r.id) }}>{r.reportType.replace(/_/g, ' ')}</Link></Td><Td>{r.dataAsOfDate}</Td><Td>{r.generatedBy}</Td></tr>)}</Tbody></Table>
      <Card><CardContent className="space-y-3">
        <h2 className="font-semibold">Recurring schedules (admin+)</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56"><Select label="Report type" value={type} onChange={setType} options={REPORT_TYPES.map(([value, label]) => ({ value: value.replace(/-/g, '_'), label }))} /></div>
          <div className="w-40"><Select label="Cadence" value={cadence} onChange={setCadence} options={['weekly', 'monthly', 'quarterly'].map(v => ({ value: v, label: v }))} /></div>
          <div className="w-28"><Select label="Format" value={format} onChange={setFormat} options={['pdf', 'json', 'both'].map(v => ({ value: v, label: v.toUpperCase() }))} /></div>
          <div className="min-w-64 flex-1"><Input label="Recipients (comma-separated, max 10)" value={recipients} onChange={e => setRecipients(e.target.value)} /></div>
          <Button onClick={() => run(() => api(wsPath(workspaceId, '/reports/schedules'), { method: 'POST', body: {
            reportType: type, cadence, format, recipients: recipients.split(',').map(v => v.trim()).filter(Boolean),
          } }))}>Create schedule</Button>
        </div>
        <ErrorLine error={schedules.error} />
        <ul className="space-y-2 text-sm">{schedules.data?.map(s => <li key={s.id} className="flex flex-wrap items-center gap-3">
          <span>{s.reportType.replace(/_/g, ' ')} · {s.cadence} · {s.format} · next {new Date(s.nextRunAt).toLocaleDateString()} · {s.paused ? 'paused' : 'active'}</span>
          <Button size="sm" variant="outline" onClick={() => run(() => api(wsPath(workspaceId, `/reports/schedules/${s.id}/pause`), { method: 'POST', body: { paused: !s.paused } }))}>{s.paused ? 'Resume' : 'Pause'}</Button>
          <Button size="sm" variant="destructive" onClick={() => run(() => api(wsPath(workspaceId, `/reports/schedules/${s.id}`), { method: 'DELETE' }))}>Delete</Button>
        </li>)}</ul>
      </CardContent></Card>
    </div>
  )
}

export function ReportViewPage({ workspaceId, reportId }: { workspaceId: string; reportId: string }) {
  const rep = useApi<any>(wsPath(workspaceId, `/reports/${reportId}`))
  const versions = useApi<any[]>(wsPath(workspaceId, `/reports/${reportId}/versions`))
  const [to, setTo] = useState('')
  const { run, error } = useAction(versions.reload)
  if (!rep.data) return <State loading={rep.loading} error={rep.error} />
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(rep.data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `report-${reportId}.json`; a.click(); URL.revokeObjectURL(url)
  }
  return (
    <div className="space-y-4">
      <Header title={rep.data.reportType.replace(/_/g, ' ')} subtitle={`Data as of ${rep.data.dataAsOfDate}`} back={{ to: '/app/workspaces/$workspaceId/reports', params: { workspaceId }, label: 'Reports' }} />
      <div className="flex flex-wrap items-end gap-3"><Button variant="outline" onClick={download}>Download JSON</Button>
        <a className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" href={`/api${wsPath(workspaceId, `/reports/${reportId}/pdf`)}`}>Download PDF</a>
        <div className="w-72"><Input placeholder="recipient@example.org (blank = CRAFT team)" value={to} onChange={e => setTo(e.target.value)} /></div>
        <Button onClick={() => run(() => api(wsPath(workspaceId, `/reports/${reportId}/email`), { method: 'POST', body: { recipients: to ? [to] : undefined } }))}>Email report</Button></div>
      <ErrorLine error={error} />
      {error === 'Email not configured' && <p role="alert" className="text-sm text-amber-800">Email is not configured. An administrator must set SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, and SUPPORT_EMAIL.</p>}
      <pre className="max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-emerald-100">{JSON.stringify(rep.data.statusSnapshot, null, 2)}</pre>
      <p className="text-sm font-semibold">Version history</p>
      <ul className="text-sm text-slate-600">{versions.data?.map(v => <li key={v.id}>v{v.versionNum}{v.emailSentTo ? ` — emailed to ${v.emailSentTo}` : ''}</li>)}</ul>
    </div>
  )
}

export function ComplianceDashboardPage({ workspaceId }: { workspaceId: string }) {
  const cap = useApi<any>(wsPath(workspaceId, '/cap/summary'))
  const alerts = useApi<any[]>(wsPath(workspaceId, '/evidence/expiry-alerts'))
  const rm = useApi<any>(wsPath(workspaceId, '/esg-roadmap'))
  const items: any[] = rm.data?.items ?? []
  return (
    <div className="space-y-6">
      <Header title="Compliance dashboard" back={dash(workspaceId)} />
      <State loading={cap.loading} error={cap.error} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="CAP completion" value={`${cap.data?.percentComplete ?? 0}%`} />
        {['critical', 'high', 'medium', 'low'].map(s => <Tile key={s} label={`Open ${s}`} value={cap.data?.bySeverity?.[s] ?? 0} tone={s === 'critical' ? 'text-rose-700' : undefined} />)}
        <Tile label="Evidence alerts" value={alerts.data?.length ?? 0} tone="text-amber-700" />
        <Tile label="ESG deadlines tracked" value={items.length} />
      </div>
    </div>
  )
}

export function SupportBotPage({ workspaceId }: { workspaceId: string }) {
  const [f, setF] = useState({ category: 'question', description: '', contactEmail: '' })
  const [done, setDone] = useState<string | null>(null)
  const { run, error, busy } = useAction()
  return (
    <div className="max-w-xl space-y-4">
      <Header title="Support bot" subtitle="Submit a bug, feature request, question or documentation issue." back={dash(workspaceId)} />
      <Select label="Category" value={f.category} onChange={category => setF({ ...f, category })} options={['bug', 'feature', 'question', 'documentation'].map(v => ({ value: v, label: v }))} />
      <Input label="Description" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
      <Input label="Contact email" type="email" value={f.contactEmail} onChange={e => setF({ ...f, contactEmail: e.target.value })} />
      <ErrorLine error={error} />{done && <p className="text-sm text-emerald-700">{done}</p>}
      <Button disabled={busy || !f.description} onClick={() => run(async () => {
        const r = await api('/support-bot/submit-issue', { method: 'POST', body: { ...f, workspaceId: Number(workspaceId) } })
        setDone(`Issue #${r.id} submitted.`); setF({ ...f, description: '' })
      })}>Submit</Button>
    </div>
  )
}

export function SupportIssuesPage({ workspaceId }: { workspaceId: string }) {
  const list = useApi<any[]>(`/support-bot/issues?workspaceId=${workspaceId}`)
  const [reply, setReply] = useState('')
  const { run, error } = useAction(list.reload)
  return (
    <div className="space-y-4">
      <Header title="Support issues" back={dash(workspaceId)} />
      <Input placeholder="Response message" value={reply} onChange={e => setReply(e.target.value)} />
      <ErrorLine error={error} /><State loading={list.loading} error={list.error} />
      <Table><Thead><tr><Th>#</Th><Th>Category</Th><Th>Description</Th><Th>Status</Th><Th>{''}</Th></tr></Thead>
        <Tbody>{list.data?.map(i => (
          <tr key={i.id}><Td>{i.id}</Td><Td>{i.category}</Td><Td>{i.description}</Td><Td><StatusPill value={i.status} /></Td>
            <Td><Button size="sm" disabled={!reply} onClick={() => run(() => api(`/support-bot/issue/${i.id}/respond`, { method: 'POST', body: { message: reply } }))}>Respond</Button></Td></tr>))}</Tbody></Table>
    </div>
  )
}
