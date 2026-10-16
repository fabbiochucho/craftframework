import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Handshake } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../components/ui'
import { scopeText, TYPE_LABEL, type EngagementScope, type EngagementType } from '../lib/engagements'

// Validator system PR 2: engagements. Every permission is enforced by
// /api/engagements; this page only reflects what the server allows.

type Engagement = {
  id: string; type: EngagementType; framework: string; scope: EngagementScope; status: string; organization: string; country: string
  createdBySide: string; requiresRereview: boolean; accessDays: number; expiresAt: string | null; inviteExpiresAt: string
  parties: { organization: string; validator: string; funder: string; validatorName: string | null; funderName: string | null }
  declined: null | { side: string; reason: string | null }
  cancelled: null | { at: string; reason: string | null }
  label: { label: string; statement: string }
  members: Array<{ email: string; name: string; role: string; orgApproved: boolean; accreditation: string; declared: boolean; access: boolean }>
  declaration: { version: string; title: string; statements: string[]; fundedPrompt: string; signed: boolean; mine: boolean }
  can: { respondAs: Array<'organization' | 'validator' | 'funder'>; manageTeam: boolean; approveMembers: boolean; cancel: boolean }
}
type Me = {
  organization: null | { name: string }
  validator: null | { accreditation: string }
  firms: Array<{ id: string; name: string; kind: string }>
}

async function api<T = any>(path: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method, cache: 'no-store',
    headers: init?.json !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error === 'mfa_required' ? 'Multi-factor sign-in required' : body?.error || `Request failed (${res.status})`)
  return body as T
}

const STATUS_STYLE: Record<string, string> = {
  proposed: 'bg-amber-100 text-amber-800', active: 'bg-emerald-100 text-emerald-800', declined: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-slate-100 text-slate-700', expired: 'bg-slate-100 text-slate-700', finalised: 'bg-indigo-100 text-indigo-800',
}
const PARTY_TEXT: Record<string, string> = { pending: 'waiting', accepted: 'accepted', declined: 'declined', not_required: '' }
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—')

function Status({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  return <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>
}

function PartyLine({ e }: { e: Engagement }) {
  const bits = [
    ['Organisation', e.parties.organization, e.organization],
    ['Validator', e.parties.validator, e.parties.validatorName ?? ''],
    ['Funding partner', e.parties.funder, e.parties.funderName ?? ''],
  ].filter(([, s]) => s !== 'not_required')
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {bits.map(([k, s, n]) => <li key={k}>{k}{n ? ` (${n})` : ''}: <span className="font-medium">{PARTY_TEXT[s]}</span></li>)}
    </ul>
  )
}

export function EngagementsPage() {
  const [items, setItems] = useState<Engagement[] | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')
  const load = () => api<Engagement[]>('/api/engagements').then(setItems, (e) => setError(e.message))
  useEffect(() => { void load(); void api<Me>('/api/directory/me').then(setMe, () => {}) }, [])
  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500"><Handshake className="h-4 w-4 text-emerald-600" /> Independent validation</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Engagements</h1>
        <p className="mt-1 text-sm text-slate-500">An engagement lets a named validator team review an organisation's results. Nothing opens until the organisation consents and each named member signs the independence declaration; access is read-only and time-limited.</p>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {me && <CreateEngagement me={me} onCreated={load} />}
      {items && !items.length && <p className="text-sm text-slate-500">You are not part of any engagement yet.</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {items?.map((e) => (
          <li key={e.id}>
            <Link to="/engagements/$id" params={{ id: e.id }} className="block h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-800">{e.organization}</p>
                <Badge className={STATUS_STYLE[e.status] ?? ''}>{e.status}</Badge>
                {e.can.respondAs.length > 0 && <Badge className="bg-indigo-100 text-indigo-800">Needs your answer</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{TYPE_LABEL[e.type]} · {scopeText(e.scope)}</p>
              <div className="mt-2"><PartyLine e={e} /></div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Create: pick the side you act for, then the counterpart from the directory.
function CreateEngagement({ me, onCreated }: { me: Me; onCreated: () => void }) {
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
  const funderFirms = me.firms.filter((f) => f.kind === 'funding_partner')
  const validatorFirms = me.firms.filter((f) => f.kind === 'validator_firm')
  const sides = [
    ...(me.organization ? [{ value: 'organization', label: `For my organisation (${me.organization.name})` }] : []),
    ...(me.validator ? [{ value: 'validator', label: 'As a validator (request an engagement)' }] : []),
    ...(funderFirms.length ? [{ value: 'funder', label: 'As a funding partner (funder review)' }] : []),
  ]
  const [side, setSide] = useState(params.get('organizationProfileId') ? (me.validator ? 'validator' : 'funder') : sides[0]?.value ?? '')
  const [type, setType] = useState<EngagementType>('independent_validation')
  const [target, setTarget] = useState({ validatorId: params.get('validatorId') ?? '', validatorFirmId: params.get('validatorFirmId') ?? '', funderFirmId: params.get('funderFirmId') ?? '', organizationProfileId: params.get('organizationProfileId') ?? '' })
  const [actFirm, setActFirm] = useState('')
  const [levels, setLevels] = useState('')
  const [days, setDays] = useState('90')
  const [rereview, setRereview] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Array<{ id: string; name: string }>>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => { if (side === 'funder') setType('funder_review'); if (side === 'validator') setType('independent_validation') }, [side])
  if (!sides.length) return null
  // What this side picks from the directory.
  const pickKind = side === 'organization' ? (type === 'funder_review' ? 'funders' : 'validators') : 'organizations'
  const search = async () => {
    try { setHits(await api(`/api/directory/search?${new URLSearchParams({ type: pickKind, q })}`)) } catch (e: any) { setMsg({ ok: false, text: e.message }) }
  }
  const pick = (id: string) => setTarget(side !== 'organization' ? { ...target, organizationProfileId: id } : type === 'funder_review' ? { ...target, funderFirmId: id } : { ...target, validatorId: id, validatorFirmId: '' })
  const chosen = side === 'organization' ? (type === 'funder_review' ? target.funderFirmId : target.validatorId || target.validatorFirmId) : target.organizationProfileId
  return (
    <Card>
      <CardHeader><CardTitle>Start an engagement</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault()
          const lv = levels.split(',').map((x) => Number(x.trim())).filter(Boolean)
          try {
            await api('/api/engagements', { method: 'POST', json: {
              side, type, accessDays: Number(days) || 90, requiresRereview: rereview,
              scope: lv.length ? { kind: 'levels', levels: lv } : { kind: 'whole' },
              ...(side === 'organization' ? (type === 'funder_review' ? { funderFirmId: target.funderFirmId } : { validatorId: target.validatorId || undefined, validatorFirmId: target.validatorFirmId || undefined })
                : { organizationProfileId: target.organizationProfileId, ...(side === 'funder' ? { funderFirmId: actFirm || funderFirms[0]?.id } : { validatorFirmId: actFirm || undefined }) }),
            } })
            setMsg({ ok: true, text: 'Engagement created. The other parties have been asked to answer.' }); onCreated()
          } catch (err: any) { setMsg({ ok: false, text: err.message }) }
        }}>
          <Select label="I am acting" options={sides} value={side} onChange={setSide} />
          {side === 'organization' && <Select label="Type" options={[{ value: 'independent_validation', label: 'Independent validation' }, { value: 'funder_review', label: 'Funder review (by a funding partner)' }]} value={type} onChange={(v) => setType(v as EngagementType)} />}
          {side === 'funder' && funderFirms.length > 1 && <Select label="Funding partner" options={funderFirms.map((f) => ({ value: f.id, label: f.name }))} value={actFirm} onChange={setActFirm} />}
          {side === 'validator' && validatorFirms.length > 0 && <Select label="On behalf of firm" placeholder="Myself" options={validatorFirms.map((f) => ({ value: f.id, label: f.name }))} value={actFirm} onChange={setActFirm} />}
          <Input label="Levels in scope (comma-separated, blank = whole ladder)" value={levels} onChange={(e) => setLevels(e.target.value)} placeholder="e.g. 1, 2, 3" />
          <Input label="Access window (days, max 365)" type="number" value={days} onChange={(e) => setDays(e.target.value)} />
          <label className="flex items-center gap-2 self-end text-sm font-medium text-slate-700">
            <input type="checkbox" checked={rereview} onChange={(e) => setRereview(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Funder requires re-review
          </label>
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium text-slate-700">{side === 'organization' ? (type === 'funder_review' ? 'Funding partner' : 'Validator or firm') : 'Organisation'}{chosen ? ' — selected' : ''}</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[14rem] flex-1"><Input label="Search the directory" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              {side === 'organization' && type === 'independent_validation' && (
                <Select label="Looking for" options={[{ value: 'validators', label: 'Individual validator' }, { value: 'firms', label: 'Validator firm' }]} value={target.validatorFirmId ? 'firms' : 'validators'} onChange={(v) => setTarget({ ...target, validatorId: '', validatorFirmId: v === 'firms' ? ' ' : '' })} />
              )}
              <Button type="button" variant="outline" onClick={() => void search()}>Search</Button>
            </div>
            <ul className="space-y-1 text-sm">
              {hits.map((h) => (
                <li key={h.id} className="flex items-center gap-2">
                  {h.name}
                  <Button type="button" size="sm" variant="ghost" onClick={() => {
                    if (side === 'organization' && type === 'independent_validation' && target.validatorFirmId) setTarget({ ...target, validatorId: '', validatorFirmId: h.id })
                    else pick(h.id)
                  }}>Select</Button>
                </li>
              ))}
            </ul>
          </div>
          <div><Button type="submit" disabled={!chosen.trim()}>Send</Button></div>
        </form>
        <Status msg={msg} />
      </CardContent>
    </Card>
  )
}

export function EngagementDetailPage({ id }: { id: string }) {
  const [e, setE] = useState<Engagement | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const load = () => api<Engagement>(`/api/engagements/${encodeURIComponent(id)}`).then(setE, (err) => setError(err.message))
  useEffect(() => { void load() }, [id])
  const act = async (fn: () => Promise<Engagement>, ok: string) => {
    try { setE(await fn()); setMsg({ ok: true, text: ok }) } catch (err: any) { setMsg({ ok: false, text: err.message }) }
  }
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  if (!e) return <p className="text-sm text-slate-500">Loading…</p>
  const post = (path: string, json?: unknown) => api<Engagement>(`/api/engagements/${encodeURIComponent(id)}${path}`, { method: 'POST', json: json ?? {} })
  return (
    <div className="space-y-6">
      <Link to="/engagements" className="text-sm text-emerald-700 hover:underline">← Engagements</Link>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-emerald-900">{e.organization}</h1>
            <Badge className={STATUS_STYLE[e.status] ?? ''}>{e.status}</Badge>
            <Badge variant="outline" className="text-slate-600">{e.label.label}</Badge>
          </div>
          <p className="text-sm text-slate-600">{e.label.statement}</p>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>{TYPE_LABEL[e.type]} · {e.framework} · {scopeText(e.scope)}{e.requiresRereview ? ' · funder requires re-review' : ''}</p>
          <PartyLine e={e} />
          <p>Access window: {e.accessDays} days from activation{e.expiresAt ? ` (ends ${fmt(e.expiresAt)})` : ` · invitation lapses ${fmt(e.inviteExpiresAt)}`}</p>
          {e.declined && <p className="text-rose-700">Declined by the {e.declined.side}.{e.declined.reason ? ` Reason: ${e.declined.reason}` : ''}</p>}
          {e.cancelled && <p className="text-slate-600">Cancelled {fmt(e.cancelled.at)}.{e.cancelled.reason ? ` ${e.cancelled.reason}` : ''} All access was revoked.</p>}
        </CardContent>
      </Card>

      {(e.status === 'active' || e.status === 'finalised') && (
        <Link to="/engagements/$id/review" params={{ id }} className="inline-block text-sm font-semibold text-emerald-700 hover:underline">
          {e.status === 'finalised' ? 'View the frozen review' : 'Open the review'}
        </Link>
      )}
      {e.can.respondAs.map((side) => <RespondCard key={side} side={side} onDecide={(decision, reason) => act(() => post('/respond', { side, decision, reason }), decision === 'accept' ? 'Accepted' : 'Declined')} />)}
      <Status msg={msg} />

      {e.declaration.mine && !e.declaration.signed && ['proposed', 'active'].includes(e.status) && (
        <DeclarationCard d={e.declaration} onSign={(body) => act(() => post('/declaration', body), 'Declaration signed')} />
      )}

      <Card>
        <CardHeader><CardTitle>Named team</CardTitle><p className="text-sm text-slate-500">Only named members the organisation approved, who have signed the declaration, can see the organisation's results — read-only, until the window ends. Firm membership alone grants nothing.</p></CardHeader>
        <CardContent className="space-y-3">
          {!e.members.length && <p className="text-sm text-slate-500">No one is named yet.</p>}
          <ul className="space-y-2 text-sm">
            {e.members.map((m) => (
              <li key={m.email} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.name}</span> <span className="text-slate-500">{m.email}</span>
                <Badge variant="outline" className="text-slate-600">{m.role}</Badge>
                <Badge className={m.accreditation === 'accredited' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>{m.accreditation}</Badge>
                <Badge className={m.declared ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>{m.declared ? 'declaration signed' : 'declaration pending'}</Badge>
                {!m.orgApproved && <Badge className="bg-amber-100 text-amber-800">awaiting organisation approval</Badge>}
                {m.access && <Badge className="bg-indigo-100 text-indigo-800">has access</Badge>}
                {!m.orgApproved && e.can.approveMembers && <Button size="sm" onClick={() => void act(() => post(`/members/${encodeURIComponent(m.email)}/approve`), 'Member approved')}>Approve</Button>}
                {e.can.manageTeam && <Button size="sm" variant="ghost" onClick={() => void act(() => api<Engagement>(`/api/engagements/${encodeURIComponent(id)}/members/${encodeURIComponent(m.email)}`, { method: 'DELETE' }), 'Member removed')}>Remove</Button>}
              </li>
            ))}
          </ul>
          {e.can.manageTeam && <AddMember onAdd={(email, role) => act(() => post('/members', { email, role }), 'Member named')} />}
        </CardContent>
      </Card>

      {e.can.cancel && <CancelCard onCancel={(reason) => act(() => post('/cancel', { reason }), 'Engagement cancelled')} />}
    </div>
  )
}

function RespondCard({ side, onDecide }: { side: string; onDecide: (d: 'accept' | 'decline', reason?: string) => void }) {
  const [reason, setReason] = useState('')
  const who = side === 'organization' ? 'the organisation' : side === 'funder' ? 'the funding partner' : 'the validator side'
  return (
    <Card className="border-indigo-200 bg-indigo-50/40">
      <CardHeader><CardTitle>Your answer for {who}</CardTitle>{side === 'organization' && <p className="text-sm text-slate-500">Accepting is your consent: it lets the named, approved team open read-only access once each signs the declaration.</p>}</CardHeader>
      <CardContent className="space-y-2">
        <Input label="Reason if declining (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex gap-2"><Button onClick={() => onDecide('accept')}>Accept</Button><Button variant="outline" onClick={() => onDecide('decline', reason)}>Decline</Button></div>
      </CardContent>
    </Card>
  )
}

function DeclarationCard({ d, onSign }: { d: Engagement['declaration']; onSign: (b: unknown) => void }) {
  const [ok, setOk] = useState(false)
  const [funded, setFunded] = useState(false)
  const [disclosure, setDisclosure] = useState('')
  const [name, setName] = useState('')
  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader><CardTitle>{d.title}</CardTitle><p className="text-xs text-slate-500">Version {d.version}. Nothing opens for you until you sign.</p></CardHeader>
      <CardContent className="space-y-3">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">{d.statements.map((s) => <li key={s}>{s}</li>)}</ol>
        <label className="flex items-start gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" /> I confirm every statement above is true.</label>
        <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={funded} onChange={(e) => setFunded(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" /> {d.fundedPrompt}</label>
        {funded && <Input label="Disclosure" value={disclosure} onChange={(e) => setDisclosure(e.target.value)} />}
        <Input label="Type your full name to sign" value={name} onChange={(e) => setName(e.target.value)} />
        <Button disabled={!ok || !name.trim() || (funded && !disclosure.trim())} onClick={() => onSign({ confirmed: true, fundedDisclosure: funded, disclosure, signedName: name })}>Sign declaration</Button>
      </CardContent>
    </Card>
  )
}

function AddMember({ onAdd }: { onAdd: (email: string, role: 'lead' | 'member') => void }) {
  const [email, setEmail] = useState('')
  const [lead, setLead] = useState(false)
  return (
    <form className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3" onSubmit={(ev) => { ev.preventDefault(); onAdd(email, lead ? 'lead' : 'member'); setEmail('') }}>
      <div className="min-w-[14rem] flex-1"><Input label="Name a team member by email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={lead} onChange={(e) => setLead(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Lead</label>
      <Button type="submit" variant="outline">Add</Button>
    </form>
  )
}

function CancelCard({ onCancel }: { onCancel: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <Card>
      <CardHeader><CardTitle>Cancel this engagement</CardTitle><p className="text-sm text-slate-500">Cancelling ends it and revokes every team member's access immediately.</p></CardHeader>
      <CardContent className="flex flex-wrap items-end gap-2">
        <div className="min-w-[14rem] flex-1"><Input label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <Button variant="outline" onClick={() => onCancel(reason)}>Cancel engagement</Button>
      </CardContent>
    </Card>
  )
}
