// Super Admin: change the moderator (owner) of any team: validator / independent-assessor firms, funding
// partners and consulting firms. Organisation moderators (Administrators) are set in the User Directory above.
import { useEffect, useState } from 'react'
import { UserCog } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from './ui'

type Team = { id: string; name: string; kind: string | null; members: Array<{ email: string; role: string; status: string }> }
const KIND: Record<string, string> = { validator_firm: 'Validator / independent assessor firm', funding_partner: 'Funder' }

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'content-type': 'application/json' } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(String(body?.error ?? `Request failed (${res.status})`))
  return body
}

export function TeamModerators() {
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [q, setQ] = useState('')
  const [add, setAdd] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const load = () => void call('/api/firms?all=1').then(setTeams, (e) => setMsg({ ok: false, text: e.message }))
  useEffect(load, [])
  const setSeat = async (firmId: string, email: string, role: 'owner' | 'consultant', ok: string) => {
    setMsg(null)
    try { await call('/api/firms', { method: 'PUT', body: JSON.stringify({ firmId, email, role }) }); setMsg({ ok: true, text: ok }); load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  const shown = (teams ?? []).filter((t) => !q.trim() || `${t.name} ${t.members.map((m) => m.email).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserCog className="h-4 w-4 text-emerald-600" /> Team moderators</CardTitle>
        <p className="text-sm text-slate-500">
          Change who moderates a funder, validator or independent-assessor team. A team always keeps at least one moderator: make
          the new one first, then remove the old one. A new person added as moderator must accept before they act. Organisation
          moderators are their Administrators, set in the User Directory above.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input label="Find a team or person" value={q} onChange={(e) => setQ(e.target.value)} />
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-emerald-700' : 'text-sm text-rose-700'}>{msg.text}</p>}
        {!teams ? <p className="text-sm text-slate-500">Loading…</p> : (
          <ul className="divide-y divide-slate-100">
            {shown.map((t) => (
              <li key={t.id} className="space-y-2 py-3 text-sm">
                <p className="font-medium text-slate-900">{t.name} <span className="text-xs font-normal text-slate-500">· {KIND[t.kind ?? ''] ?? 'Consulting firm'}</span></p>
                {t.members.map((m) => (
                  <div key={m.email} className="flex flex-wrap items-center gap-2 pl-3">
                    <span>{m.email}</span>
                    <Badge variant="outline" className="text-slate-500">{m.role === 'owner' ? 'moderator' : 'member'}</Badge>
                    {m.status !== 'active' && <Badge className="bg-amber-100 text-amber-800">{m.status}</Badge>}
                    {m.status === 'active' && (
                      <Button size="sm" variant="ghost" onClick={() => void setSeat(t.id, m.email, m.role === 'owner' ? 'consultant' : 'owner', m.role === 'owner' ? `${m.email} is no longer a moderator.` : `${m.email} is now a moderator.`)}>
                        {m.role === 'owner' ? 'Remove as moderator' : 'Make moderator'}
                      </Button>
                    )}
                  </div>
                ))}
                <form className="flex flex-wrap items-end gap-2 pl-3" onSubmit={(e) => { e.preventDefault(); const email = (add[t.id] ?? '').trim().toLowerCase(); if (email) void setSeat(t.id, email, 'owner', `${email} added as moderator.`).then(() => setAdd({ ...add, [t.id]: '' })) }}>
                  <Input aria-label={`Add a moderator to ${t.name}`} placeholder="Add a moderator by email" value={add[t.id] ?? ''} onChange={(e) => setAdd({ ...add, [t.id]: e.target.value })} />
                  <Button size="sm" type="submit" variant="outline">Add moderator</Button>
                </form>
              </li>
            ))}
            {!shown.length && <li className="py-3 text-sm text-slate-500">No teams found.</li>}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
