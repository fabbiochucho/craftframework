// Settings & Team, for funding-partner staff (and the Super Admin): the funder's own grants, report types and funding
// streams, one per line, which the organisations it funds then choose in Finance Triangulation.
import { useEffect, useState } from 'react'
import { Landmark } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from './ui'
import { SUPPORT_TYPES } from '../lib/supportTypes'

type Item = { id: string; name: string; types?: string[] }
type Programme = { id: string; name: string; grants: Item[]; reportTypes: Item[]; streams: Item[] }
const FIELDS = [
  { key: 'grants', label: 'Grants or projects', hint: 'For example: Youth TB Community Response 2025–2027' },
  { key: 'reportTypes', label: 'Report types', hint: 'For example: Quarterly financial report' },
  { key: 'streams', label: 'Funding streams or tranches (optional)', hint: 'For example: Core, Tranche 2' },
] as const
const lines = (xs: Item[]) => xs.map((x) => x.name).join('\n')
const field = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'

// The organisations this funder names as beneficiaries of each grant (by contact email). They are told and decide
// whether to add the grant to their awards; naming them shares nothing about them with the funder.
function Beneficiaries({ p }: { p: Programme }) {
  const [rows, setRows] = useState<{ grantId: string; email: string; amount: string | null; currency: string }[]>([])
  const [grantId, setGrantId] = useState(p.grants[0]?.id ?? '')
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('')
  const [msg, setMsg] = useState('')
  const load = () => fetch(`/api/funder-programmes?beneficiaries=${encodeURIComponent(p.id)}`).then((r) => (r.ok ? r.json() : { beneficiaries: [] })).then((d) => setRows(d.beneficiaries ?? []), () => {})
  useEffect(() => { void load() }, [p.id])
  if (!p.grants.length) return null
  const send = async (method: 'POST' | 'DELETE', body: object) => {
    const r = await fetch('/api/funder-programmes', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ firmId: p.id, ...body }) })
    const d = await r.json().catch(() => null)
    setMsg(r.ok ? (method === 'POST' ? 'Added. The organisation has been told and can add the grant to its awards.' : 'Removed.') : d?.error ?? 'Could not save.')
    if (r.ok) { setEmail(''); setAmount(''); void load() }
  }
  const grantName = (id: string) => p.grants.find((g) => g.id === id)?.name ?? id
  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <p className="text-sm font-semibold text-slate-800">Beneficiary organisations</p>
      <p className="text-xs text-slate-500">Name an organisation by its contact email, with the amount allocated to it if you wish (only that organisation sees it). It is told by email and in its CRAFT inbox, and chooses whether to add the grant to its awards. You see its results only if it shares them with you.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-slate-600">Grant
          <select value={grantId} onChange={(e) => setGrantId(e.target.value)} className={field}>{p.grants.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        </label>
        <label className="min-w-[14rem] flex-1 text-xs font-medium text-slate-600">Organisation contact email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@organisation.org" className={field} />
        </label>
        <label className="w-32 text-xs font-medium text-slate-600">Amount (optional)
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
        </label>
        <label className="w-20 text-xs font-medium text-slate-600">Currency
          <input value={currency} maxLength={10} onChange={(e) => setCurrency(e.target.value)} placeholder="EUR" className={field} />
        </label>
        <Button variant="outline" disabled={!email.trim()} onClick={() => void send('POST', { grantId, email: email.trim(), amount: amount === '' ? null : Number(amount), currency })}>Add</Button>
      </div>
      {msg && <p role="status" className="text-xs text-slate-600">{msg}</p>}
      {rows.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {rows.map((r) => (
            <li key={r.grantId + r.email} className="flex items-center justify-between py-1">
              <span><span className="text-slate-800">{r.email}</span> <span className="text-xs text-slate-500">· {grantName(r.grantId)}{r.amount != null && ` · ${Number(r.amount).toLocaleString()} ${r.currency}`}</span></span>
              <button type="button" onClick={() => void send('DELETE', { grantId: r.grantId, email: r.email })} className="text-xs text-rose-700 underline">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function FunderProgrammesCard() {
  const [list, setList] = useState<Programme[]>([])
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [msg, setMsg] = useState<Record<string, string>>({})
  // Type of support per grant, by grant name: { [firmId]: { [grant name]: type ids } }.
  const [types, setTypes] = useState<Record<string, Record<string, string[]>>>({})
  useEffect(() => {
    fetch('/api/funder-programmes?mine=1').then((r) => (r.ok ? r.json() : { programmes: [] })).then((d: { programmes: Programme[] }) => {
      setList(d.programmes)
      setDrafts(Object.fromEntries(d.programmes.map((p) => [p.id, { grants: lines(p.grants), reportTypes: lines(p.reportTypes), streams: lines(p.streams) }])))
      setTypes(Object.fromEntries(d.programmes.map((p) => [p.id, Object.fromEntries(p.grants.map((g) => [g.name, g.types ?? []]))])))
    }, () => {})
  }, [])
  if (!list.length) return null
  const save = async (id: string) => {
    const d = drafts[id]
    const split = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
    const res = await fetch('/api/funder-programmes', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ firmId: id, grants: split(d.grants), reportTypes: split(d.reportTypes), streams: split(d.streams), grantTypes: types[id] ?? {} }) })
    const body = await res.json().catch(() => null)
    setMsg({ ...msg, [id]: res.ok ? 'Saved. Organisations can now choose these in Finance Triangulation.' : body?.error ?? 'Could not save.' })
  }
  return (
    <>
      {list.map((p) => (
        <Card key={p.id}>
          <CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="h-4 w-4" /> {p.name}: grants and report types</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">One per line. Organisations on CRAFT see these names when they choose a funder for a finance report, so use names you are happy for them to see.</p>
            {FIELDS.map((f) => (
              <label key={f.key} className="block text-xs font-medium text-slate-600">{f.label}
                <textarea rows={3} className={field} placeholder={f.hint} value={drafts[p.id]?.[f.key] ?? ''}
                  onChange={(e) => setDrafts({ ...drafts, [p.id]: { ...drafts[p.id], [f.key]: e.target.value } })} />
              </label>
            ))}
            {(() => {
              const names = (drafts[p.id]?.grants ?? '').split('\n').map((x) => x.trim()).filter(Boolean)
              if (!names.length) return null
              const set = (name: string, t: string, on: boolean) => {
                const cur = types[p.id]?.[name] ?? []
                setTypes({ ...types, [p.id]: { ...types[p.id], [name]: on ? [...cur, t] : cur.filter((x) => x !== t) } })
              }
              return (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-600">Type of support for each grant</p>
                  {names.map((name) => (
                    <div key={name} className="rounded-lg border border-slate-200 p-2">
                      <p className="text-sm font-medium text-slate-800">{name}</p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        {SUPPORT_TYPES.map((t) => (
                          <label key={t.id} className="flex items-center gap-1.5 text-xs text-slate-700" title={t.blurb}>
                            <input type="checkbox" checked={(types[p.id]?.[name] ?? []).includes(t.id)} onChange={(e) => set(name, t.id, e.target.checked)} />
                            {t.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
            <div className="flex items-center gap-3">
              <Button onClick={() => void save(p.id)}>Save</Button>
              {msg[p.id] && <p role="status" className="text-sm text-slate-600">{msg[p.id]}</p>}
            </div>
            <Beneficiaries p={p} />
          </CardContent>
        </Card>
      ))}
    </>
  )
}
