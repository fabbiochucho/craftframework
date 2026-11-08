// Invite a funding partner's staff (e.g. GIZ) into the funder's ONE shared account, each with their own
// invitation. Saved as drafts to review and send. Joining shares nothing: organisations consent per funder review.
import { useState } from 'react'
import { Landmark, Plus, Trash } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from './ui'
import { inviteFunderByEmail } from '../lib/api'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function InviteFunderCard({ onBehalfOf, onDone }: { onBehalfOf?: string; onDone?: () => void }) {
  const [funder, setFunder] = useState('')
  const [people, setPeople] = useState([{ name: '', email: '' }])
  const [message, setMessage] = useState('')
  const [subject, setSubject] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const filled = people.filter((p) => p.email.trim())
  const valid = funder.trim().length >= 2 && filled.length > 0 && filled.every((p) => EMAIL.test(p.email.trim()))
  const set = (i: number, k: 'name' | 'email', v: string) => setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)))
  const save = async () => {
    setBusy(true); setMsg(null)
    const failed: string[] = []
    for (const p of filled) {
      const out = await inviteFunderByEmail({ email: p.email.trim().toLowerCase(), funderName: funder.trim(), inviteeName: p.name.trim() || undefined, message: message.trim() || undefined, subject: subject.trim() || undefined, send: false, onBehalfOf })
      if (!out.ok) failed.push(`${p.email}: ${out.error}`)
    }
    setBusy(false)
    const ok = filled.length - failed.length
    setMsg(failed.length ? { ok: false, text: `Saved ${ok}. Not saved: ${failed.join('; ')}` } : { ok: true, text: `Saved ${ok} draft${ok === 1 ? '' : 's'}. Review and send them under Invitations waiting to be sent.` })
    if (!failed.length) { setPeople([{ name: '', email: '' }]); onDone?.() }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Landmark className="h-4 w-4 text-emerald-600" /> Invite a funder</CardTitle>
        <p className="text-sm text-slate-500">
          Each person gets their own invitation and joins the funder's one shared account on CRAFT. Joining shares nothing: an
          organisation's results are visible to the funder only through a funder review that the organisation proposes or accepts.
          Invitations are saved as drafts for you to review and send.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input label="Funding partner" placeholder="For example GIZ" value={funder} onChange={(e) => setFunder(e.target.value)} />
        {people.map((p, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Input label={i === 0 ? 'Name (optional)' : undefined} aria-label="Name" value={p.name} onChange={(e) => set(i, 'name', e.target.value)} />
            <Input label={i === 0 ? 'Email' : undefined} aria-label="Email" type="email" value={p.email} onChange={(e) => set(i, 'email', e.target.value)} />
            <Button size="sm" variant="outline" aria-label="Remove" disabled={people.length === 1} onClick={() => setPeople((ps) => ps.filter((_, j) => j !== i))}><Trash className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setPeople((ps) => [...ps, { name: '', email: '' }])}><Plus className="h-4 w-4" /> Add another person</Button>
        <Input label="Email subject (optional)" placeholder="Leave empty for the standard subject" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Message (optional)</span>
          <textarea className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <Button disabled={!valid || busy} onClick={() => void save()}>{busy ? 'Saving…' : `Save ${filled.length || ''} draft${filled.length === 1 ? '' : 's'}`}</Button>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-emerald-700' : 'text-sm text-rose-700'}>{msg.text}</p>}
      </CardContent>
    </Card>
  )
}
