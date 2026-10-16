import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { BadgeCheck, Search } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Tabs } from '../components/ui'
import { FIRM_KINDS, natureOptions, type FirmKind } from '../lib/validatorDirectory'

// Validator system PR 1: the signed-in three-way directory (validators,
// validator firms, funding partners, opted-in organisations) and the forms for
// a person's own profiles. Every rule is enforced by /api/directory and
// /api/firms; this page only reflects what the server allows.

type Kind = 'validators' | 'firms' | 'organizations'
type Me = {
  email: string
  isAdmin: boolean
  isFunder: boolean
  canBrowseOrganizations: boolean
  validator: null | {
    id: string; name: string; bio: string; competencies: string[]; frameworks: string[]; countries: string[]; languages: string[]
    accreditation: string; level: string; credentials: Array<{ id: string; body: string; membershipNumber: string; status: string }>
  }
  firms: Array<FirmProfile & { role: string }>
  invitations: Array<{ id: string; name: string; kind: FirmKind }>
  organization: null | { name: string; id: string | null; listed: boolean; summary: string }
}
type FirmProfile = {
  id: string; kind: FirmKind; name: string; nature: string; summary: string; competencies: string[]
  countries: string[]; sectors: string[]; ticketSize: string | null; teamSize: number
}

async function api<T = any>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init, cache: 'no-store',
    headers: init?.json !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error === 'mfa_required' ? 'Multi-factor sign-in required' : body?.error || `Request failed (${res.status})`)
  return body as T
}

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
const joined = (l?: string[] | null) => (l ?? []).join(', ')
const KIND_LABEL: Record<FirmKind, string> = { validator_firm: 'Validator firm', funding_partner: 'Funding partner' }
const ACCREDITATION_STYLE: Record<string, string> = {
  accredited: 'bg-emerald-100 text-emerald-800', 'pilot-accredited': 'bg-indigo-100 text-indigo-800',
  registered: 'bg-slate-100 text-slate-700', suspended: 'bg-rose-100 text-rose-800',
}

function Accreditation({ value, level }: { value: string; level?: string }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge className={ACCREDITATION_STYLE[value] ?? ''}>{value === 'pilot-accredited' ? 'Pilot-accredited' : value[0].toUpperCase() + value.slice(1)}</Badge>
      {level && <Badge variant="outline" className="text-slate-600">{level}</Badge>}
    </span>
  )
}

function Textarea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
    </label>
  )
}

function Status({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  return <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>
}

export function DirectoryPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('search')
  const reload = () => api<Me>('/api/directory/me').then(setMe, (e) => setError(e.message))
  useEffect(() => { void reload() }, [])

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500"><Search className="h-4 w-4 text-emerald-600" /> Independent validation</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Validator Directory</h1>
        <p className="mt-1 text-sm text-slate-500">Find validators, validator firms and funding partners. Profiles show professional details only — never scores, evidence or contact details.</p>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <Tabs tabs={[{ id: 'search', label: 'Search' }, { id: 'profile', label: 'My profiles' }]} active={tab} onChange={setTab} />
      {me && tab === 'search' && <SearchPanel me={me} />}
      {me && tab === 'profile' && <MyProfiles me={me} reload={reload} />}
    </div>
  )
}

function SearchPanel({ me }: { me: Me }) {
  const [type, setType] = useState('validators')
  const [q, setQ] = useState('')
  const [country, setCountry] = useState('')
  const [results, setResults] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const run = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError('')
    try { setResults(await api(`/api/directory/search?${new URLSearchParams({ type, q, country })}`)) } catch (err: any) { setError(err.message) }
  }
  useEffect(() => { void run() }, [type])
  const types = [
    { value: 'validators', label: 'Validators' }, { value: 'firms', label: 'Validator firms' }, { value: 'funders', label: 'Funding partners' },
    ...(me.canBrowseOrganizations ? [{ value: 'organizations', label: 'Organisations (opted in)' }] : []),
  ]
  const kindFor = (t: string): Kind => (t === 'validators' ? 'validators' : t === 'organizations' ? 'organizations' : 'firms')
  return (
    <div className="space-y-4">
      <form onSubmit={run} className="grid gap-3 sm:grid-cols-[12rem_1fr_12rem_auto] sm:items-end">
        <Select label="Looking for" options={types} value={type} onChange={setType} />
        <Input label="Keywords" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, competency, sector…" />
        <Input label="Country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Kenya" />
        <Button type="submit">Search</Button>
      </form>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {results && !results.length && <p className="text-sm text-slate-500">No profiles match.</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {results?.map((r) => (
          <li key={r.id}>
            <Link to="/directory/$kind/$id" params={{ kind: kindFor(type), id: r.id }} className="block h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <p className="font-semibold text-slate-800">{r.name}</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {type === 'validators' ? joined(r.firms?.map((f: any) => f.name)) || 'Independent' : type === 'organizations' ? [r.country, r.sector].filter(Boolean).join(' · ') : r.nature}
              </p>
              {type === 'validators' && <div className="mt-2"><Accreditation value={r.accreditation} level={r.level} /></div>}
              {type === 'organizations' && r.currentRung != null && <p className="mt-2 text-sm text-slate-600">Capital Readiness rung {r.currentRung} (self-assessed)</p>}
              {(r.competencies?.length || r.countries?.length) ? <p className="mt-2 text-xs text-slate-500">{[joined(r.competencies), joined(r.countries)].filter(Boolean).join(' · ')}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MyProfiles({ me, reload }: { me: Me; reload: () => void }) {
  return (
    <div className="space-y-6">
      {me.invitations.map((inv) => (
        <Card key={inv.id} className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            <p className="text-sm text-slate-700">{inv.name} ({KIND_LABEL[inv.kind]}) added you to its team.</p>
            <Button size="sm" onClick={() => void api('/api/firms', { method: 'PUT', json: { firmId: inv.id, email: me.email, status: 'active' } }).then(reload)}>Accept</Button>
          </CardContent>
        </Card>
      ))}
      <ValidatorForm me={me} reload={reload} />
      {me.firms.map((f) => <FirmForm key={f.id} firm={f} reload={reload} />)}
      <FirmForm reload={reload} />
      <OrgListing me={me} reload={reload} />
    </div>
  )
}

function ValidatorForm({ me, reload }: { me: Me; reload: () => void }) {
  const v = me.validator
  const [f, setF] = useState({ name: v?.name ?? '', bio: v?.bio ?? '', competencies: joined(v?.competencies), frameworks: joined(v?.frameworks), countries: joined(v?.countries), languages: joined(v?.languages) })
  const [cred, setCred] = useState({ body: '', membershipNumber: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMsg({ ok: true, text: ok }); reload() } catch (e: any) { setMsg({ ok: false, text: e.message }) }
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  return (
    <Card>
      <CardHeader>
        <CardTitle>My validator profile</CardTitle>
        <p className="text-sm text-slate-500">Anyone can register as a validator. Accreditation is earned (training and assessment) or granted by the CRAFT programme team for the pilot.</p>
        {v && <div className="mt-2"><Accreditation value={v.accreditation} level={v.level} /></div>}
      </CardHeader>
      <CardContent className="space-y-3">
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
          e.preventDefault()
          void act(() => api('/api/directory/me/validator', { method: 'PUT', json: { name: f.name, bio: f.bio, competencies: list(f.competencies), frameworks: list(f.frameworks), countries: list(f.countries), languages: list(f.languages) } }), 'Profile saved')
        }}>
          <Input label="Professional name" required value={f.name} onChange={set('name')} />
          <Input label="Competencies (comma-separated)" value={f.competencies} onChange={set('competencies')} />
          <Input label="Frameworks" value={f.frameworks} onChange={set('frameworks')} placeholder="CRAFT Capital Readiness Ladder" />
          <Input label="Countries" value={f.countries} onChange={set('countries')} />
          <Input label="Languages" value={f.languages} onChange={set('languages')} />
          <div className="sm:col-span-2"><Textarea label="Bio" value={f.bio} onChange={(bio) => setF({ ...f, bio })} /></div>
          <div><Button type="submit">{v ? 'Save profile' : 'Create validator profile'}</Button></div>
        </form>
        {v && (
          <div className="border-t border-slate-100 pt-3">
            <h4 className="text-sm font-semibold text-slate-700">Professional memberships</h4>
            <p className="text-xs text-slate-500">Shown as self-declared until the CRAFT programme team checks the body's public register.</p>
            <ul className="mt-2 space-y-1">
              {v.credentials.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                  {c.body} · {c.membershipNumber}
                  <Badge className={c.status === 'verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>{c.status}</Badge>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void act(() => api(`/api/directory/me/credentials/${c.id}`, { method: 'DELETE' }), 'Membership removed')}>Remove</Button>
                </li>
              ))}
            </ul>
            <form className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => {
              e.preventDefault()
              void act(() => api('/api/directory/me/credentials', { method: 'POST', json: cred }).then(() => setCred({ body: '', membershipNumber: '' })), 'Membership added')
            }}>
              <Input label="Professional body" required value={cred.body} onChange={(e) => setCred({ ...cred, body: e.target.value })} placeholder="e.g. ICAN, ACCA" />
              <Input label="Membership number" required value={cred.membershipNumber} onChange={(e) => setCred({ ...cred, membershipNumber: e.target.value })} />
              <Button type="submit" variant="outline">Add</Button>
            </form>
          </div>
        )}
        <Status msg={msg} />
      </CardContent>
    </Card>
  )
}

function FirmForm({ firm, reload }: { firm?: FirmProfile & { role: string }; reload: () => void }) {
  const [kind, setKind] = useState<FirmKind>(firm?.kind ?? 'validator_firm')
  const [f, setF] = useState({ name: firm?.name ?? '', nature: firm?.nature ?? '', summary: firm?.summary ?? '', competencies: joined(firm?.competencies), countries: joined(firm?.countries), sectors: joined(firm?.sectors), ticketSize: firm?.ticketSize ?? '' })
  const [seats, setSeats] = useState<Array<{ email: string; role: string; status: string }>>([])
  const [seat, setSeat] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const owner = !firm || firm.role === 'owner'
  const loadSeats = () => { if (firm) void api(`/api/firms?firmId=${encodeURIComponent(firm.id)}`).then(setSeats, () => {}) }
  useEffect(loadSeats, [firm?.id])
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMsg({ ok: true, text: ok }); loadSeats(); reload() } catch (e: any) { setMsg({ ok: false, text: e.message }) }
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const funder = kind === 'funding_partner'
  const payload = { name: f.name, nature: f.nature, summary: f.summary, competencies: list(f.competencies), countries: list(f.countries), sectors: list(f.sectors), ticketSize: f.ticketSize || null }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{firm ? `${KIND_LABEL[firm.kind]}: ${firm.name}` : 'Register a validator firm or funding partner'}</CardTitle>
        {firm && <Link to="/directory/$kind/$id" params={{ kind: 'firms', id: firm.id }} className="text-sm text-emerald-700 hover:underline">View directory profile</Link>}
      </CardHeader>
      <CardContent className="space-y-3">
        <fieldset disabled={!owner} className="grid gap-3 sm:grid-cols-2">
          {!firm && <Select label="Profile type" options={FIRM_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} value={kind} onChange={(k) => { setKind(k as FirmKind); setF({ ...f, nature: '' }) }} />}
          <Input label="Name" required value={f.name} onChange={set('name')} />
          <Select label={funder ? 'Investor type' : 'Nature'} placeholder="Choose…" options={natureOptions(kind).map((n) => ({ value: n, label: n }))} value={f.nature} onChange={(nature) => setF({ ...f, nature })} />
          <Input label={funder ? 'Focus areas' : 'Competencies'} value={f.competencies} onChange={set('competencies')} />
          <Input label="Countries" value={f.countries} onChange={set('countries')} />
          {funder && <Input label="Focus sectors" value={f.sectors} onChange={set('sectors')} />}
          {funder && <Input label="Ticket size (optional)" value={f.ticketSize} onChange={set('ticketSize')} placeholder="e.g. USD 50k–500k" />}
          <div className="sm:col-span-2"><Textarea label="Summary" value={f.summary} onChange={(summary) => setF({ ...f, summary })} /></div>
          <div>
            <Button type="button" onClick={() => void act(
              () => firm ? api('/api/firms', { method: 'PATCH', json: { firmId: firm.id, ...payload } }) : api('/api/firms', { method: 'POST', json: { kind, ...payload } }).then(() => setF({ name: '', nature: '', summary: '', competencies: '', countries: '', sectors: '', ticketSize: '' })),
              firm ? 'Profile saved' : 'Profile created',
            )}>{firm ? 'Save' : 'Create profile'}</Button>
          </div>
        </fieldset>
        {firm && (
          <div className="border-t border-slate-100 pt-3">
            <h4 className="text-sm font-semibold text-slate-700">{funder ? 'Staff' : 'Team members'}</h4>
            <ul className="mt-1 space-y-1 text-sm">
              {seats.map((s) => (
                <li key={s.email} className="flex flex-wrap items-center gap-2">
                  {s.email} <Badge variant="outline" className="text-slate-500">{s.role}</Badge>
                  {s.status !== 'active' && <Badge className="bg-amber-100 text-amber-800">{s.status}</Badge>}
                  {owner && s.role !== 'owner' && <Button size="sm" variant="ghost" onClick={() => void act(() => api(`/api/firms?firmId=${encodeURIComponent(firm.id)}&email=${encodeURIComponent(s.email)}`, { method: 'DELETE' }), 'Removed')}>Remove</Button>}
                </li>
              ))}
            </ul>
            {owner && (
              <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => {
                e.preventDefault()
                void act(() => api('/api/firms', { method: 'PUT', json: { firmId: firm.id, email: seat } }).then(() => setSeat('')), 'Member added')
              }}>
                <div className="min-w-[14rem] flex-1"><Input label="Add by email" type="email" required value={seat} onChange={(e) => setSeat(e.target.value)} /></div>
                <Button type="submit" variant="outline">Add</Button>
              </form>
            )}
          </div>
        )}
        <Status msg={msg} />
      </CardContent>
    </Card>
  )
}

function OrgListing({ me, reload }: { me: Me; reload: () => void }) {
  const [listed, setListed] = useState(me.organization?.listed ?? false)
  const [summary, setSummary] = useState(me.organization?.summary ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!me.organization) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organisation listing: {me.organization.name}</CardTitle>
        <p className="text-sm text-slate-500">Off by default. When on, signed-in funding partners can find a brief profile: name, country, sector, your self-assessed Capital Readiness rung and this summary. Never scores, evidence or comments.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={listed} onChange={(e) => setListed(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
          List my organisation in the directory
        </label>
        <Textarea label="Brief summary" value={summary} onChange={setSummary} rows={2} />
        <Button onClick={async () => {
          try { await api('/api/directory/me/organization', { method: 'PUT', json: { listed, summary } }); setMsg({ ok: true, text: listed ? 'Listed' : 'Not listed' }); reload() } catch (e: any) { setMsg({ ok: false, text: e.message }) }
        }}>Save listing</Button>
        <Status msg={msg} />
      </CardContent>
    </Card>
  )
}

// Brief profile page: /directory/$kind/$id
export function DirectoryProfilePage({ kind, id }: { kind: string; id: string }) {
  const [p, setP] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState('')
  const load = () => api(`/api/directory/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`).then(setP, (e) => setError(e.message))
  useEffect(() => {
    void load()
    void api<Me>('/api/directory/me').then((m) => setIsAdmin(m.isAdmin), () => {})
  }, [kind, id])
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  if (!p) return <p className="text-sm text-slate-500">Loading…</p>
  const tags = (label: string, l?: string[] | null) => l?.length ? <p className="text-sm"><span className="font-medium text-slate-700">{label}:</span> {joined(l)}</p> : null
  return (
    <div className="space-y-6">
      <Link to="/directory" className="text-sm text-emerald-700 hover:underline">← Directory</Link>
      <a href={`/engagements?${new URLSearchParams(kind === 'validators' ? { validatorId: id } : kind === 'organizations' ? { organizationProfileId: id } : { [p?.kind === 'funding_partner' ? 'funderFirmId' : 'validatorFirmId']: id })}`} className="ml-4 text-sm font-semibold text-emerald-700 hover:underline">Start an engagement</a>
      <Card>
        <CardHeader>
          <h1 className="font-display text-2xl font-bold text-emerald-900">{p.name}</h1>
          <p className="text-sm text-slate-500">
            {kind === 'validators' ? (p.firms?.length ? p.firms.map((f: any) => f.name).join(', ') : 'Independent validator')
              : kind === 'organizations' ? [p.country, p.sector].filter(Boolean).join(' · ') : `${KIND_LABEL[p.kind as FirmKind]} · ${p.nature}`}
          </p>
          {kind === 'validators' && <div className="mt-2"><Accreditation value={p.accreditation} level={p.level} /></div>}
        </CardHeader>
        <CardContent className="space-y-2">
          {(p.bio || p.summary) && <p className="whitespace-pre-line text-sm text-slate-700">{p.bio || p.summary}</p>}
          {kind === 'organizations' && <p className="text-sm">Capital Readiness rung: {p.currentRung ?? '—'} <span className="text-slate-500">(self-assessed)</span></p>}
          {tags(kind === 'validators' ? 'Competencies' : p.kind === 'funding_partner' ? 'Focus areas' : 'Competencies', p.competencies)}
          {tags('Frameworks', p.frameworks)}
          {tags('Countries', p.countries)}
          {tags('Languages', p.languages)}
          {tags('Focus sectors', p.sectors)}
          {p.ticketSize && <p className="text-sm"><span className="font-medium text-slate-700">Ticket size:</span> {p.ticketSize}</p>}
          {kind === 'firms' && <p className="text-sm text-slate-600">{p.teamSize} {p.kind === 'funding_partner' ? 'staff' : 'team members'}</p>}
          {p.team?.length > 0 && (
            <ul className="text-sm">{p.team.map((t: any) => <li key={t.id}><Link to="/directory/$kind/$id" params={{ kind: 'validators', id: t.id }} className="text-emerald-700 hover:underline">{t.name}</Link></li>)}</ul>
          )}
          {p.credentials?.length > 0 && (
            <div>
              <h2 className="mt-2 text-sm font-semibold text-slate-700">Professional memberships</h2>
              <ul className="space-y-1">
                {p.credentials.map((c: any) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                    {c.body} · {c.membershipNumber}
                    <Badge className={c.status === 'verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                      {c.status === 'verified' && <BadgeCheck className="mr-1 h-3 w-3" />}{c.status}
                    </Badge>
                    {isAdmin && <Button size="sm" variant="ghost" onClick={() => void api(`/api/directory/admin/credentials/${c.id}`, { method: 'PUT', json: { verified: c.status !== 'verified' } }).then(load, (e) => setError(e.message))}>
                      {c.status === 'verified' ? 'Mark self-declared' : 'Mark verified'}
                    </Button>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
      {isAdmin && kind === 'validators' && <AccreditationAdmin profile={p} onDone={load} />}
    </div>
  )
}

function AccreditationAdmin({ profile, onDone }: { profile: any; onDone: () => void }) {
  const [status, setStatus] = useState<string>(profile.accreditationStatus)
  const [pilot, setPilot] = useState<boolean>(profile.pilotAccredited)
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accreditation (platform admin)</CardTitle>
        {profile.accreditationReason && <p className="text-sm text-slate-500">Last recorded reason: {profile.accreditationReason}</p>}
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Select label="Status" options={['registered', 'accredited', 'suspended'].map((s) => ({ value: s, label: s }))} value={status} onChange={setStatus} />
        <label className="flex items-center gap-2 self-end text-sm font-medium text-slate-700">
          <input type="checkbox" checked={pilot} onChange={(e) => setPilot(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Pilot-accredited
        </label>
        <div className="sm:col-span-2"><Textarea label="Reason (recorded in the audit log)" value={reason} onChange={setReason} rows={2} /></div>
        <div>
          <Button disabled={!reason.trim()} onClick={async () => {
            try {
              await api(`/api/directory/admin/validators/${profile.id}`, { method: 'PUT', json: { status, pilotAccredited: pilot, reason } })
              setMsg({ ok: true, text: 'Accreditation updated' }); setReason(''); onDone()
            } catch (e: any) { setMsg({ ok: false, text: e.message }) }
          }}>Record change</Button>
        </div>
        <Status msg={msg} />
      </CardContent>
    </Card>
  )
}
