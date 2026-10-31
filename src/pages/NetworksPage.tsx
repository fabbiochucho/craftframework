import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, BadgeCheck, Network } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../components/ui'
import { CoordinatorRounds, MemberRounds } from '../components/NetworkRounds'
import { ExchangeLog } from '../components/NetworkExchange'
import { ProgrammeScorecards } from '../components/ProgrammeScorecards'
import { useAuthCtx } from '../lib/context'
import { canSeePreview, getFramework } from '../lib/frameworks'
import { LEVEL_LABEL, NETWORK_LEVELS, SHARING_LABEL, ancestry, canNest, type NetworkLevel, type NetworkNode, type Sharing } from '../lib/networks'
import { NETWORK_TEMPLATES, TEMPLATE_LABEL, type NetworkTemplate } from '../lib/networkTemplates'

// Civil society networks: levels from global to local, coordinators per level, and member organisations that
// join by accepting an invitation. Every rule is enforced by /api/networks.

async function api<T = any>(path: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method, cache: 'no-store',
    headers: init?.json !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error === 'mfa_required' ? 'Confirm your two-step sign-in, then try again.' : body?.error || `Request failed (${res.status})`)
  return body as T
}

type Membership = { id: string; status: string; sharing: Sharing; orgId: string; orgName: string; nodeName: string; level: string; networkId: string; networkName: string; setUpBy: string; verified: boolean; archived: boolean }
type Home = { canCreate: boolean; isSuperAdmin: boolean; networks: Array<{ id: string; name: string; description: string; status: string; kind: string; verified: boolean; setUpBy: string; coordinating: boolean }>; memberships: Membership[] }
type TreeNode = NetworkNode & { members?: number }
type Detail = {
  network: { id: string; name: string; description: string; status: string; kind: string; verified: boolean; setUpBy: string; canModerate: boolean }
  nodes: TreeNode[]; coordinates: string[]; views: string[]
  admins: Array<{ nodeId: string; email: string; role: string }>
  members: null | { counts: { invited: number; accepted: number; declined: number }; named: Array<{ memberId: string; nodeId: string; orgId: string; name: string }>; totalsOnly: number }
  pending: number
  mine: Array<{ id: string; nodeId: string; orgId: string; status: string; sharing: Sharing }>
}

const levelOptions = (from?: NetworkLevel) => NETWORK_LEVELS.filter((l) => !from || canNest(from, l)).map((l) => ({ value: l, label: LEVEL_LABEL[l] }))
const sharingOptions = (Object.keys(SHARING_LABEL) as Sharing[]).map((s) => ({ value: s, label: SHARING_LABEL[s] }))

function MembershipCard({ m, onDone }: { m: Membership; onDone: () => void }) {
  const [sharing, setSharing] = useState<Sharing>(m.sharing)
  const [error, setError] = useState('')
  const act = async (action: string) => {
    setError('')
    try { await api(`/api/networks/members/${m.id}`, { method: 'POST', json: { action, sharing } }); onDone() } catch (e) { setError((e as Error).message) }
  }
  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{m.networkName}</p>
          <p className="text-sm text-slate-600">{m.orgName} · {m.nodeName} ({LEVEL_LABEL[m.level as NetworkLevel] ?? m.level})</p>
          <p className="text-xs text-slate-500">Set up by {m.setUpBy}{m.verified ? <span className="ml-1 inline-flex items-center gap-0.5 text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified by CRAFT</span> : ' · not verified by CRAFT'}</p>
          {m.archived && <p className="text-xs font-medium text-rose-700">CRAFT has archived this network.</p>}
        </div>
        <Badge className={m.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>{m.status === 'accepted' ? 'Member' : 'Invitation'}</Badge>
      </div>
      <Select label="What the network may see" options={sharingOptions} value={sharing} onChange={(v) => setSharing(v as Sharing)} />
      <p className="text-xs text-slate-500">Either way the network never sees your evidence files. Results for groups of fewer than 5 organisations are hidden, unless every organisation in the group chose named results.</p>
      <div className="flex flex-wrap gap-2">
        {m.status === 'invited' ? (
          <><Button size="sm" onClick={() => void act('accept')}>Accept invitation</Button><Button size="sm" variant="outline" onClick={() => void act('decline')}>Decline</Button></>
        ) : (
          <><Button size="sm" onClick={() => void act('sharing')} disabled={sharing === m.sharing}>Save sharing choice</Button><Button size="sm" variant="outline" onClick={() => void act('leave')}>Leave network</Button><Link to="/networks/$networkId" params={{ networkId: m.networkId }} className="inline-flex items-center rounded-md px-3 py-1.5 text-sm text-emerald-700 hover:underline">Learning and exchange →</Link></>
        )}
      </div>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      {m.status === 'accepted' && <MemberRounds networkId={m.networkId} />}
    </div>
  )
}

export function NetworksPage() {
  const [home, setHome] = useState<Home | null>(null)
  const [error, setError] = useState('')
  const setup = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('setup') : null
  const [form, setForm] = useState({ name: '', description: '', kind: (setup === 'cohort' ? 'cohort' : 'network') as 'network' | 'cohort',
    template: (setup === 'cohort' ? 'cohort' : 'blank') as NetworkTemplate, level: (setup === 'cohort' ? 'global' : 'national') as NetworkLevel, rootName: '', geoCode: '' })
  const load = useCallback(() => { void api<Home>('/api/networks').then(setHome, (e) => setError(e.message)) }, [])
  useEffect(load, [load])

  const create = async () => {
    setError('')
    try {
      const top = form.template === 'blank' || form.template === 'cohort' ? { level: form.level, name: form.rootName || form.name, geoCode: form.geoCode } : { level: 'national' as NetworkLevel, name: form.name, geoCode: '' }
      await api('/api/networks', { method: 'POST', json: { name: form.name, description: form.description, kind: form.kind, template: form.template, root: top } })
      setForm({ ...form, name: '', description: '', rootName: '', geoCode: '' }); load()
    } catch (e) { setError((e as Error).message) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Network className="h-6 w-6 text-emerald-700" aria-hidden /> Networks</h1>
        <p className="mt-1 max-w-3xl text-slate-600">
          Civil society networks assess their member organisations together, from a global network down to a state, province or district.
          Each organisation decides whether the network sees its named results or only counts it in the totals.
        </p>
      </div>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      {!home ? <p className="text-slate-500">Loading…</p> : (
        <>
          {home.memberships.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Your organisation's networks</CardTitle></CardHeader>
              <CardContent className="space-y-3">{home.memberships.map((m) => <MembershipCard key={m.id} m={m} onDone={load} />)}</CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Networks you coordinate</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {home.networks.filter((n) => n.coordinating).length === 0 && <p className="text-sm text-slate-500">You don't coordinate a network. A network's coordinators add you at your level.</p>}
              {home.networks.filter((n) => n.coordinating).map((n) => (
                <Link key={n.id} to="/networks/$networkId" params={{ networkId: n.id }} className="block rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">{n.name}
                    {n.kind === 'cohort' && <Badge variant="outline">Cohort</Badge>}
                    {n.verified && <span className="inline-flex items-center gap-0.5 text-xs font-normal text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified</span>}
                    {n.status === 'archived' && <Badge className="bg-rose-100 text-rose-800">Archived</Badge>}</p>
                  {n.description && <p className="text-sm text-slate-600">{n.description}</p>}
                  {home.isSuperAdmin && <p className="text-xs text-slate-500">Set up by {n.setUpBy}</p>}
                </Link>
              ))}
            </CardContent>
          </Card>
          {home.canCreate && (
            <Card>
              <CardHeader><CardTitle>{form.kind === 'cohort' ? 'Set up a grantee cohort' : 'Set up a network'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600">
                  {form.kind === 'cohort'
                    ? 'A cohort groups the organisations you fund so you can follow their readiness together. You become its coordinator; grantees join only if they accept, and choose what you see.'
                    : 'You become the coordinator of the top level and can add levels, coordinators and members. Members join only if they accept, and choose what the network sees.'}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select label="This is" options={[{ value: 'network', label: 'A network or coalition' }, { value: 'cohort', label: "A funder's grantee cohort" }]} value={form.kind}
                    onChange={(v) => setForm({ ...form, kind: v as 'network' | 'cohort', template: v === 'cohort' ? 'cohort' : 'blank' })} />
                  <Input label={form.kind === 'cohort' ? 'Cohort name (e.g. GIZ Health Systems Grantees 2026)' : 'Network name'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <Input label="What it does (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  {form.kind === 'network' && <Select label="Starting structure" options={NETWORK_TEMPLATES.filter((t) => t !== 'cohort').map((t) => ({ value: t, label: TEMPLATE_LABEL[t] }))} value={form.template} onChange={(v) => setForm({ ...form, template: v as NetworkTemplate })} />}
                  {(form.template === 'blank' || form.template === 'cohort') && (
                    <>
                      <Select label="Its top level" options={levelOptions()} value={form.level} onChange={(v) => setForm({ ...form, level: v as NetworkLevel })} />
                      <Input label="Name of the top level (e.g. Africa, Nigeria, or the cohort)" value={form.rootName} onChange={(e) => setForm({ ...form, rootName: e.target.value })} />
                      <Input label="Geography code (optional: NG, NG-LA, ECOWAS)" value={form.geoCode} onChange={(e) => setForm({ ...form, geoCode: e.target.value })} />
                    </>
                  )}
                </div>
                <Button onClick={() => void create()} disabled={form.name.trim().length < 3}>{form.kind === 'cohort' ? 'Create cohort' : 'Create network'}</Button>
                <p className="text-xs text-slate-500">Members see who set the network up before they accept. New networks can send up to 50 invitations a day until CRAFT verifies them.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function NodeTools({ networkId, node, onDone }: { networkId: string; node: TreeNode; onDone: () => void }) {
  const [child, setChild] = useState({ level: (levelOptions(node.level)[0]?.value ?? 'local') as NetworkLevel, name: '', geoCode: '' })
  const [admin, setAdmin] = useState({ email: '', role: 'coordinator' })
  const [org, setOrg] = useState('')
  const [msg, setMsg] = useState('')
  const run = async (path: string, json: unknown, ok: string) => {
    setMsg('')
    try { await api(`/api/networks/${networkId}/${path}`, { method: 'POST', json }); setMsg(ok); onDone() } catch (e) { setMsg((e as Error).message) }
  }
  const childLevels = levelOptions(node.level)
  return (
    <div className="mt-3 grid gap-4 rounded-lg bg-slate-50 p-3 lg:grid-cols-3">
      {childLevels.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">Add a level below</p>
          <Select label="Level" options={childLevels} value={child.level} onChange={(v) => setChild({ ...child, level: v as NetworkLevel })} />
          <Input label="Name" value={child.name} onChange={(e) => setChild({ ...child, name: e.target.value })} />
          <Input label="Geography code (optional)" value={child.geoCode} onChange={(e) => setChild({ ...child, geoCode: e.target.value })} />
          <Button size="sm" disabled={child.name.trim().length < 2} onClick={() => void run('nodes', { parentId: node.id, ...child }, 'Level added')}>Add level</Button>
        </div>
      )}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-800">Add a coordinator</p>
        <Input label="Email" type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} />
        <Select label="Role" options={[{ value: 'coordinator', label: 'Coordinator (manages this level and below)' }, { value: 'viewer', label: 'Viewer (sees results only)' }]} value={admin.role} onChange={(v) => setAdmin({ ...admin, role: v })} />
        <Button size="sm" disabled={!admin.email.includes('@')} onClick={() => void run('admins', { nodeId: node.id, ...admin }, 'Coordinator added')}>Add</Button>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-800">Invite an organisation</p>
        <Input label="CRAFT organisation ID or contact email" value={org} onChange={(e) => setOrg(e.target.value)} />
        <p className="text-xs text-slate-500">The organisation must already use CRAFT. It joins only if it accepts, and chooses what you see.</p>
        <Button size="sm" disabled={org.trim().length < 2} onClick={() => void run('invitations', { nodeId: node.id, org }, 'Invitation sent')}>Invite</Button>
      </div>
      {msg && <p className="text-sm text-slate-700 lg:col-span-3">{msg}</p>}
    </div>
  )
}

function Moderation({ id, verified, archived, onDone }: { id: string; verified: boolean; archived: boolean; onDone: () => void }) {
  const [msg, setMsg] = useState('')
  const set = async (json: { verified?: boolean; archived?: boolean }) => {
    setMsg('')
    try { await api(`/api/networks/${id}/moderate`, { method: 'POST', json }); onDone() } catch (e) { setMsg((e as Error).message) }
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Super Admin</span>
      <Button size="sm" variant="outline" onClick={() => void set({ verified: !verified })}>{verified ? 'Remove verified badge' : 'Mark as verified'}</Button>
      <Button size="sm" variant="outline" onClick={() => void set({ archived: !archived })}>{archived ? 'Restore network' : 'Archive network'}</Button>
      {msg && <span className="text-rose-700">{msg}</span>}
    </div>
  )
}

type Overview = {
  profile: { parts: Array<{ key: string; label: string; value: number | null }>; combined: number | null; formula: string }
  secretariat: null | { score: number; band: string | null; answered: number; total: number }
  members: null | { round: string; instrument: string; submitted: number; median: number | null; suppressed: boolean }
  useRate: number | null; acceptedMembers: number; alerts: string[]
}

/** The top of a network's page: its profile in three figures (plus a labelled combined one) and what needs attention. */
function NetworkOverview({ id }: { id: string }) {
  const [o, setO] = useState<Overview | null>(null)
  useEffect(() => { void api<Overview>(`/api/networks/${id}/overview`).then(setO, () => setO(null)) }, [id])
  if (!o) return null
  return (
    <Card>
      <CardHeader><CardTitle>Network profile</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {o.profile.parts.map((p) => (
            <div key={p.key} className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{p.label}</p>
              <p className="text-2xl font-semibold tabular-nums text-slate-900">{p.value == null ? '—' : `${p.value}`}<span className="text-sm font-normal text-slate-500">{p.value == null ? '' : '/100'}</span></p>
              <p className="text-xs text-slate-500">
                {p.key === 'secretariat' && (o.secretariat ? `${o.secretariat.band ?? ''} · ${o.secretariat.answered} of ${o.secretariat.total} answered` : 'Not assessed yet')}
                {p.key === 'members' && (o.members ? (o.members.suppressed ? `${o.members.submitted} submitted in ${o.members.round}; shown from 5` : `${o.members.round} · ${o.members.submitted} members`) : 'No round results yet')}
                {p.key === 'use' && `${o.acceptedMembers} member${o.acceptedMembers === 1 ? '' : 's'}`}
              </p>
            </div>
          ))}
        </div>
        {o.profile.combined != null && (
          <p className="text-sm text-slate-800"><span className="font-semibold">Combined figure: {o.profile.combined}/100.</span> <span className="text-slate-500">{o.profile.formula}</span></p>
        )}
        {o.alerts.length > 0 && (
          <ul className="space-y-1">
            {o.alerts.map((a) => <li key={a} className="flex items-start gap-2 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />{a}</li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function NetworkDetailPage({ networkId }: { networkId: string }) {
  const { currentUser } = useAuthCtx()
  const [d, setD] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const load = useCallback(() => { void api<Detail>(`/api/networks/${networkId}`).then(setD, (e) => setError(e.message)) }, [networkId])
  useEffect(load, [load])
  if (error) return <p className="text-sm text-rose-700">{error}</p>
  if (!d) return <p className="text-slate-500">Loading…</p>

  const children = (pid: string | null) => d.nodes.filter((n) => n.parentId === pid)
  const coord = new Set(d.coordinates)
  const renderNode = (n: TreeNode, depth: number): React.ReactNode => (
    <li key={n.id} className="space-y-1">
      <div className="flex flex-wrap items-center gap-2" style={{ paddingLeft: depth * 20 }}>
        <span className="font-medium text-slate-900">{n.name}</span>
        <Badge variant="outline">{LEVEL_LABEL[n.level]}</Badge>
        {n.geoCode && <span className="font-mono text-xs text-slate-500">{n.geoCode}</span>}
        {n.members !== undefined && <span className="text-xs text-slate-600">{n.members} member{n.members === 1 ? '' : 's'}</span>}
        {coord.has(n.id) && <Button size="sm" variant="outline" onClick={() => setOpen(open === n.id ? null : n.id)}>{open === n.id ? 'Close' : 'Manage'}</Button>}
      </div>
      {open === n.id && <div style={{ paddingLeft: depth * 20 }}><NodeTools networkId={d.network.id} node={n} onDone={load} /></div>}
      {children(n.id).length > 0 && <ul className="space-y-1">{children(n.id).map((c) => renderNode(c, depth + 1))}</ul>}
    </li>
  )
  const nodeName = (id: string) => d.nodes.find((n) => n.id === id)?.name ?? ''

  return (
    <div className="space-y-6">
      <div>
        <Link to="/networks" className="text-sm text-emerald-700 hover:underline">← Networks</Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold text-slate-900">{d.network.name}
          {d.network.verified && <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700"><BadgeCheck className="h-4 w-4" aria-hidden /> Verified by CRAFT</span>}
          {d.network.status === 'archived' && <Badge className="bg-rose-100 text-rose-800">Archived</Badge>}</h1>
        <p className="text-xs text-slate-500">{d.network.kind === 'cohort' ? 'Grantee cohort' : 'Network'} set up by {d.network.setUpBy}</p>
        {d.network.canModerate && <Moderation id={d.network.id} verified={d.network.verified} archived={d.network.status === 'archived'} onDone={load} />}
        {d.network.description && <p className="mt-1 max-w-3xl text-slate-600">{d.network.description}</p>}
      </div>
      {(d.coordinates.length > 0 || d.views.length > 0) && <NetworkOverview id={d.network.id} />}
      {d.members && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[['Members', d.members.counts.accepted], ['Invitations waiting', d.members.counts.invited], ['Named results', d.members.named.length], ['Totals only', d.members.totalsOnly]].map(([label, value]) => (
            <Card key={label as string}><CardContent className="py-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="text-2xl font-semibold tabular-nums text-slate-900">{value}</p></CardContent></Card>
          ))}
        </div>
      )}
      {d.coordinates.length > 0 && (!getFramework('craft-network')?.preview || canSeePreview(currentUser?.role)) && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm text-slate-700">Assess the network's own secretariat or coordinating body with the <span className="font-medium">CRAFT Network Capacity Index</span>, alongside your members' results.</p>
            <Link to="/assessment/$frameworkId" params={{ frameworkId: 'craft-network' }} className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50">Assess the secretariat</Link>
          </CardContent>
        </Card>
      )}
      {d.coordinates.length > 0 || d.views.length > 0 ? <CoordinatorRounds networkId={d.network.id} nodes={d.nodes} coordinates={d.coordinates} /> : null}
      {(d.coordinates.length > 0 || d.views.length > 0) && <ProgrammeScorecards networkId={d.network.id} nodes={d.nodes} coordinates={d.coordinates} />}
      <ExchangeLog networkId={d.network.id} nodes={d.nodes} coordinates={d.coordinates} named={d.members?.named.map((x) => ({ orgId: x.orgId, name: x.name })).filter((x, i, a) => a.findIndex((y) => y.orgId === x.orgId) === i) ?? []} />
      <Card>
        <CardHeader><CardTitle>Levels</CardTitle></CardHeader>
        <CardContent><ul className="space-y-2">{children(null).map((n) => renderNode(n, 0))}</ul></CardContent>
      </Card>
      {d.members && d.members.named.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Members sharing named results</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {d.members.named.map((m) => <li key={m.memberId} className="py-2 text-sm"><span className="font-medium text-slate-900">{m.name}</span> <span className="text-slate-500">· {ancestry(d.nodes, m.nodeId).map((x) => x.name).join(' › ')}</span></li>)}
            </ul>
            <p className="mt-3 text-xs text-slate-500">{d.members.totalsOnly} other member{d.members.totalsOnly === 1 ? '' : 's'} chose totals only and {d.members.totalsOnly === 1 ? 'is' : 'are'} counted in network results without being named.</p>
          </CardContent>
        </Card>
      )}
      {d.admins.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Coordinators</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {d.admins.map((a) => <li key={a.nodeId + a.email} className="py-2 text-sm"><span className="text-slate-900">{a.email}</span> <span className="text-slate-500">· {a.role} · {nodeName(a.nodeId)}</span></li>)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
