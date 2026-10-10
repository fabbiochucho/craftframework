import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { api, downloadApi, selectedMembership, wsPath } from '../../lib/workspaceApi'
import { useAuthCtx } from '../../lib/context'
import { Button, Card, CardContent, CardTitle, CardHeader, Input, Select, Table, Thead, Tbody, Th, Td, ProgressBar } from '../../components/ui'
import { ErrorLine, Header, State, StatusPill, Tile, useAction, useApi } from './shared'

type Org = { id: number; name: string; type: string; country: string; region: string; contactEmail: string; role: string }

function useOrg() {
  const orgs = useApi<Org[]>('/orgs')
  const { currentUser } = useAuthCtx()
  const key = `craft.workspace.org:${currentUser?.email?.toLowerCase() ?? ''}`
  const [selection, setSelection] = useState<{ key: string; id: string | null }>({ key: '', id: null })
  useEffect(() => {
    let id = null
    try { id = localStorage.getItem(key) } catch { /* Storage may be disabled. */ }
    setSelection({ key, id })
  }, [key])
  const org = selectedMembership(orgs.data ?? [], selection.key === key ? selection.id : null)
  const select = (id: string) => {
    if (!orgs.data?.some(o => String(o.id) === id)) return
    setSelection({ key, id })
    try { localStorage.setItem(key, id) } catch { /* Selection still works without storage. */ }
  }
  return { ...orgs, org, selector: <Select label="Organization" value={String(org?.id ?? '')} onChange={select} options={(orgs.data ?? []).map(o => ({ value: String(o.id), label: o.name }))} /> }
}

function CreateOrg({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ name: '', type: 'private', country: '' })
  const { run, error, busy } = useAction(onDone)
  return (
    <Card>
      <CardHeader><CardTitle>Create your organization</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-500">An organizational email domain is required (consumer mailboxes are rejected).</p>
        <Input label="Organization name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <Select label="Type" value={f.type} onChange={type => setF({ ...f, type })} options={[{ value: 'government', label: 'Government' }, { value: 'ngo', label: 'NGO' }, { value: 'private', label: 'Private' }]} />
        <Input label="Country" value={f.country} onChange={e => setF({ ...f, country: e.target.value })} />
        <ErrorLine error={error} />
        <Button disabled={busy || !f.name} onClick={() => run(() => api('/orgs', { method: 'POST', body: f }))}>Create organization</Button>
      </CardContent>
    </Card>
  )
}

export function OrgSettingsPage() {
  const { org, selector, loading, error, reload } = useOrg()
  const [f, setF] = useState<Partial<Org> | null>(null)
  useEffect(() => { setF(null) }, [org?.id])
  const { run, error: saveErr, busy } = useAction(reload)
  if (loading || error) return <State loading={loading} error={error} />
  if (!org) return <CreateOrg onDone={reload} />
  const v = { ...org, ...f }
  const canEdit = org.role === 'owner' || org.role === 'admin'
  return (
    <div className="max-w-2xl space-y-4">
      <Header title="Organization settings" subtitle={`Your role: ${org.role}`} />
      {selector}
      <div key={org.id} className="space-y-4">
      <Input label="Name" disabled={!canEdit} value={v.name} onChange={e => setF({ ...f, name: e.target.value })} />
      <Input label="Country" disabled={!canEdit} value={v.country} onChange={e => setF({ ...f, country: e.target.value })} />
      <Input label="Region" disabled={!canEdit} value={v.region} onChange={e => setF({ ...f, region: e.target.value })} />
      <Input label="Contact email" disabled={!canEdit} value={v.contactEmail} onChange={e => setF({ ...f, contactEmail: e.target.value })} />
      <ErrorLine error={saveErr} />
      {canEdit && <Button disabled={busy || !f} onClick={() => run(() => api(`/orgs/${org.id}`, { method: 'PUT', body: f }))}>Save</Button>}
      </div>
      <PrivacyControls key={`privacy-${org.id}`} org={org} />
    </div>
  )
}

export function OrgMembersPage() {
  const { org, selector, loading, error } = useOrg()
  const members = useApi<{ id: number; userId: string; role: string; joinedAt: string }[]>(org ? `/orgs/${org.id}/members` : null)
  const [inv, setInv] = useState({ email: '', role: 'viewer' })
  const { run, error: actErr, busy } = useAction(members.reload)
  if (loading || error) return <State loading={loading} error={error} />
  if (!org) return <p className="text-sm text-slate-500">Create an organization first in <Link to="/app/org/settings" className="text-emerald-700 underline">settings</Link>.</p>
  const canManage = org.role === 'owner' || org.role === 'admin'
  return (
    <div className="space-y-6">
      <Header title="Members" subtitle={org.name} />
      {selector}
      {canManage && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-72"><Input label="Email" value={inv.email} onChange={e => setInv({ ...inv, email: e.target.value })} /></div>
          <div className="w-40"><Select label="Role" value={inv.role} onChange={role => setInv({ ...inv, role })} options={['viewer', 'assessor', 'admin', 'owner'].map(r => ({ value: r, label: r }))} /></div>
          <Button disabled={busy || !inv.email} onClick={() => run(() => api(`/orgs/${org.id}/members`, { method: 'POST', body: inv }))}>Invite / set role</Button>
        </div>
      )}
      <ErrorLine error={actErr} />
      <State loading={members.loading} error={members.error} />
      <Table>
        <Thead><tr><Th>Member</Th><Th>Role</Th><Th>Joined</Th><Th>{''}</Th></tr></Thead>
        <Tbody>
          {members.data?.map(m => (
            <tr key={m.id}>
              <Td>{m.userId}</Td><Td>{m.role}</Td><Td>{new Date(m.joinedAt).toLocaleDateString()}</Td>
              <Td>{canManage && <Button size="sm" variant="destructive" onClick={() => run(() => api(`/orgs/${org.id}/members/${m.id}`, { method: 'DELETE' }))}>Remove</Button>}</Td>
            </tr>
          ))}
        </Tbody>
      </Table>
    </div>
  )
}

// Org-level audit view: pick a workspace, then read its audit trail (admins only).
export function OrgAuditLogPage() {
  const { org, selector, loading, error } = useOrg()
  const wss = useApi<{ id: number; workspaceName: string }[]>(org ? `/orgs/${org.id}/workspaces` : null)
  const [ws, setWs] = useState('')
  const wsId = wss.data?.find(w => String(w.id) === ws)?.id ?? wss.data?.[0]?.id
  const log = useApi<any[]>(wsId ? wsPath(wsId, '/audit-log') : null)
  const { run, error: exportError } = useAction()
  if (loading || error) return <State loading={loading} error={error} />
  return (
    <div className="space-y-4">
      <Header title="Audit log" subtitle="Admin only — every mutation and sensitive read is recorded." />
      {selector}
      <div className="w-64"><Select value={String(wsId ?? '')} onChange={setWs} options={(wss.data ?? []).map(w => ({ value: String(w.id), label: w.workspaceName }))} /></div>
      <div className="flex gap-2">{['csv', 'json'].map(format => <Button key={format} disabled={!wsId} onClick={() => run(() => downloadApi(wsPath(wsId!, '/audit-log/export'), `audit-log.${format}`, { format }))}>Export {format.toUpperCase()}</Button>)}</div>
      <ErrorLine error={exportError} /><State loading={wss.loading} error={wss.error} />
      <State loading={log.loading} error={log.error} />
      <Table>
        <Thead><tr><Th>When</Th><Th>Actor</Th><Th>Resource</Th><Th>Action</Th><Th>IP</Th></tr></Thead>
        <Tbody>{log.data?.map(r => (
          <tr key={r.id}><Td>{new Date(r.timestamp).toLocaleString()}</Td><Td>{r.actorId}</Td><Td>{r.resourceType} {r.resourceId}</Td><Td>{r.action}</Td><Td>{r.ipAddress}</Td></tr>
        ))}</Tbody>
      </Table>
    </div>
  )
}

export function WorkspacesPage() {
  const { org, selector, loading, error, reload: reloadOrg } = useOrg()
  const wss = useApi<{ id: number; workspaceName: string; description: string; status: string }[]>(org ? `/orgs/${org.id}/workspaces` : null)
  const [name, setName] = useState('')
  const { run, error: actErr, busy } = useAction(async () => { setName(''); await wss.reload() })
  if (loading || error) return <State loading={loading} error={error} />
  if (!org) return <CreateOrg onDone={reloadOrg} />
  return (
    <div className="space-y-6">
      <Header title="Workspaces" subtitle={org.name} />
      {selector}
      <State loading={wss.loading} error={wss.error} />
      {(org.role === 'owner' || org.role === 'admin') && (
        <div className="flex items-end gap-3">
          <div className="w-72"><Input label="New workspace" value={name} onChange={e => setName(e.target.value)} /></div>
          <Button disabled={busy || !name} onClick={() => run(() => api(`/orgs/${org.id}/workspaces`, { method: 'POST', body: { workspaceName: name } }))}>Create</Button>
        </div>
      )}
      <ErrorLine error={actErr} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {wss.data?.map(w => (
          <Link key={w.id} to="/app/workspaces/$workspaceId/dashboard" params={{ workspaceId: String(w.id) }}>
            <Card><CardContent><p className="font-semibold text-emerald-900">{w.workspaceName}</p><p className="text-sm text-slate-500">{w.description}</p><StatusPill value={w.status} /></CardContent></Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

function PrivacyControls({ org }: { org: Org }) {
  const requests = useApi<any[]>('/privacy/erasure-requests')
  const { run, busy, error } = useAction(requests.reload)
  return <Card><CardContent className="space-y-3">
    <h2 className="font-semibold">Privacy and personal data</h2>
    <p className="text-sm text-slate-600">Export your personal data across memberships. Erasure applies to this organization and requires approval by a different administrator; audit records are retained.</p>
    <div className="flex gap-2">
      <Button disabled={busy} variant="outline" onClick={() => run(() => downloadApi('/privacy/export', 'personal-data.json'))}>Export personal data</Button>
      <Button disabled={busy} variant="destructive" onClick={() => { if (confirm(`Request erasure of your personal data in ${org.name}?`)) void run(() => api('/privacy/erasure-requests', { method: 'POST', body: { orgId: org.id } })) }}>Request erasure</Button>
    </div>
    <ErrorLine error={error} /><State loading={requests.loading} error={requests.error} />
    <ul className="space-y-2 text-sm">{requests.data?.filter(r => r.orgId === org.id).map(r => <li key={r.id}>
      #{r.id} · {r.requestedBy} · <StatusPill value={r.status} />
      {r.status === 'pending' && ['admin', 'owner'].includes(org.role) && <Button size="sm" disabled={busy} onClick={() => { if (confirm('Approve irreversible personal data erasure?')) void run(() => api(`/privacy/erasure-requests/${r.id}/approve`, { method: 'POST', body: {} })) }}>Approve erasure</Button>}
    </li>)}</ul>
  </CardContent></Card>
}

const SECTIONS: [string, string][] = [
  ['/app/workspaces/$workspaceId/governance/assessments', 'Governance assessments'],
  ['/app/workspaces/$workspaceId/esg/frameworks', 'ESG frameworks'],
  ['/app/workspaces/$workspaceId/esg/roadmap', 'ESG roadmap'],
  ['/app/workspaces/$workspaceId/actions', 'Corrective actions'],
  ['/app/workspaces/$workspaceId/evidence', 'Evidence registry'],
  ['/app/workspaces/$workspaceId/reports', 'Reports'],
  ['/app/workspaces/$workspaceId/compliance-dashboard', 'Compliance dashboard'],
  ['/app/workspaces/$workspaceId/support-bot', 'Support bot'],
  ['/app/workspaces/$workspaceId/support-issues', 'Support issues'],
]

export function WorkspaceDashboardPage({ workspaceId }: { workspaceId: string }) {
  const cap = useApi<any>(wsPath(workspaceId, '/cap/summary'))
  const assessments = useApi<any[]>(wsPath(workspaceId, '/assessments'))
  const evidence = useApi<any[]>(wsPath(workspaceId, '/evidence'))
  const roadmap = useApi<any>(wsPath(workspaceId, '/esg-roadmap'))
  const err = cap.error ?? assessments.error
  const items = roadmap.data?.items ?? []
  const esgPct = items.length ? Math.round(items.reduce((a: number, i: any) => a + i.percentComplete, 0) / items.length) : 0
  return (
    <div className="space-y-6">
      <Header title="Workspace dashboard" back={{ to: '/app/workspaces', label: 'All workspaces' }} />
      <State loading={cap.loading} error={err} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Open CAPs" value={cap.data?.open ?? '–'} />
        <Tile label="Overdue CAPs" value={cap.data?.overdue ?? '–'} tone="text-rose-700" />
        <Tile label="Assessments" value={assessments.data?.length ?? '–'} />
        <Tile label="Evidence pending review" value={evidence.data?.filter(e => e.status === 'pending_review').length ?? '–'} tone="text-amber-700" />
      </div>
      <Card><CardContent><p className="text-sm font-semibold text-slate-600">ESG implementation {esgPct}%</p><ProgressBar value={esgPct} /></CardContent></Card>
      <div className="grid gap-3 md:grid-cols-3">
        {SECTIONS.map(([to, label]) => (
          <Link key={to} to={to} params={{ workspaceId }} className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-emerald-800 hover:bg-emerald-50">{label}</Link>
        ))}
      </div>
    </div>
  )
}
