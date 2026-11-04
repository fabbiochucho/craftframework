// Super Admin: the internal support tracker. Everything that arrives (support chat, bot escalations, private reports,
// the contact form) lands here as a ticket, and requests that came by email, phone, WhatsApp or a meeting can be
// logged by hand. Notes stay internal; replies are emailed to the contact and recorded on the timeline.
import { useCallback, useEffect, useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../ui'
import { supportTickets as api } from '../../lib/api'
import { cn } from '../../lib/utils'
import {
  isOverdue, MANUAL_SOURCES, SOURCE_LABEL, STATUS_LABEL, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_SOURCES, TICKET_STATUSES,
  type TicketSource, type TicketStatus, type TicketSummary,
} from '../../lib/supportTickets'

type Detail = TicketSummary & { body: string; sourceRef: string; createdBy: string; resolvedAt: string | null }
type Event = { id: number; kind: string; body: string; actor: string; emailStatus: string | null; createdAt: string }

const opts = (list: readonly string[], label?: Record<string, string>) => list.map((v) => ({ value: v, label: label?.[v] ?? v[0].toUpperCase() + v.slice(1) }))
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const PRIORITY_STYLE: Record<string, string> = { urgent: 'bg-rose-100 text-rose-800', high: 'bg-amber-100 text-amber-800', normal: 'bg-slate-100 text-slate-700', low: 'bg-slate-50 text-slate-500' }
const STATUS_STYLE: Record<string, string> = { new: 'bg-indigo-100 text-indigo-800', open: 'bg-emerald-100 text-emerald-800', waiting: 'bg-amber-50 text-amber-800', resolved: 'bg-slate-100 text-slate-600', closed: 'bg-slate-100 text-slate-500' }
const textarea = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'

export function SupportPanel() {
  const [filter, setFilter] = useState({ status: 'active', source: '', q: '' })
  const [list, setList] = useState<{ tickets: TicketSummary[]; counts: Record<string, number> } | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [logging, setLogging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString()
      setList(await api(`?${qs}`)); setError(null)
    } catch (e) { setError((e as Error).message) }
  }, [filter])
  useEffect(() => { void load() }, [load])

  const now = new Date()
  const counts = list?.counts ?? {}
  const chips: { status: string; label: string; n: number }[] = [
    { status: 'active', label: 'Active', n: (counts.new ?? 0) + (counts.open ?? 0) + (counts.waiting ?? 0) },
    { status: 'overdue', label: 'Overdue', n: counts.overdue ?? 0 },
    ...TICKET_STATUSES.map((s) => ({ status: s, label: STATUS_LABEL[s], n: counts[s] ?? 0 })),
    { status: 'all', label: 'All', n: TICKET_STATUSES.reduce((a, s) => a + (counts[s] ?? 0), 0) },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button key={c.status} type="button" onClick={() => setFilter({ ...filter, status: c.status })}
            className={cn('rounded-full border px-3 py-1 text-xs font-semibold', filter.status === c.status ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300',
              c.status === 'overdue' && c.n > 0 && filter.status !== 'overdue' && 'border-rose-300 text-rose-700')}>
            {c.label} <span className="ml-1 opacity-80">{c.n}</span>
          </button>
        ))}
        <div className="ml-auto"><Button size="sm" onClick={() => { setLogging(true); setSelected(null) }}>Log a request</Button></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <Input aria-label="Search tickets" placeholder="Search subject, name, email, organisation or #id" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        <Select value={filter.source} onChange={(source) => setFilter({ ...filter, source })} options={[{ value: '', label: 'All sources' }, ...opts(TICKET_SOURCES, SOURCE_LABEL)]} />
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardContent className="p-0">
            {!list ? <p className="p-4 text-sm text-slate-500">Loading…</p>
              : list.tickets.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No tickets here.</p>
              : (
                <ul className="divide-y divide-slate-100">
                  {list.tickets.map((t) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => { setSelected(t.id); setLogging(false) }}
                        className={cn('w-full px-4 py-3 text-left hover:bg-slate-50', selected === t.id && 'bg-emerald-50')}>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-slate-400">#{t.id}</span>
                          <span className={cn('rounded px-1.5 py-0.5 font-semibold', STATUS_STYLE[t.status])}>{STATUS_LABEL[t.status as TicketStatus] ?? t.status}</span>
                          <span className={cn('rounded px-1.5 py-0.5', PRIORITY_STYLE[t.priority])}>{t.priority}</span>
                          {isOverdue(t, now) && <span className="rounded bg-rose-600 px-1.5 py-0.5 font-semibold text-white">overdue</span>}
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-slate-900">{t.subject}</p>
                        <p className="truncate text-xs text-slate-500">
                          {SOURCE_LABEL[t.source as TicketSource] ?? t.source} · {t.contactName || t.contactEmail || 'no contact'}{t.organisation && ` · ${t.organisation}`} · {when(t.createdAt)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </CardContent>
        </Card>
        {logging ? <LogRequest onDone={(id) => { setLogging(false); if (id) setSelected(id); void load() }} />
          : selected ? <TicketView key={selected} id={selected} onChanged={load} />
          : <Card><CardContent className="py-12 text-center text-sm text-slate-500">Choose a ticket, or log a request that came by email, phone, WhatsApp or a meeting.</CardContent></Card>}
      </div>
    </div>
  )
}

function LogRequest({ onDone }: { onDone: (id: number | null) => void }) {
  const [f, setF] = useState({ subject: '', body: '', source: 'email', contactName: '', contactEmail: '', organisation: '', category: 'question', priority: 'normal' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v })
  const save = async () => {
    setBusy(true); setError(null)
    try { onDone((await api<{ id: number }>('', { method: 'POST', body: f })).id) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Log a request</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Input label="Subject" value={f.subject} onChange={(e) => set('subject')(e.target.value)} />
        <label className="block text-sm font-medium text-slate-700">What they asked
          <textarea rows={5} className={cn(textarea, 'mt-1')} value={f.body} onChange={(e) => set('body')(e.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="Came by" value={f.source} onChange={set('source')} options={opts(MANUAL_SOURCES, SOURCE_LABEL)} />
          <Select label="Category" value={f.category} onChange={set('category')} options={opts(TICKET_CATEGORIES)} />
          <Select label="Priority" value={f.priority} onChange={set('priority')} options={opts(TICKET_PRIORITIES)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Name" value={f.contactName} onChange={(e) => set('contactName')(e.target.value)} />
          <Input label="Email" type="email" value={f.contactEmail} onChange={(e) => set('contactEmail')(e.target.value)} />
          <Input label="Organisation" value={f.organisation} onChange={(e) => set('organisation')(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy || f.subject.trim().length < 2}>Save ticket</Button>
          <Button variant="ghost" onClick={() => onDone(null)}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TicketView({ id, onChanged }: { id: number; onChanged: () => void }) {
  const [data, setData] = useState<{ ticket: Detail; events: Event[] } | null>(null)
  const [note, setNote] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => { try { setData(await api(`/${id}`)) } catch (e) { setMessage((e as Error).message) } }, [id])
  useEffect(() => { void load() }, [load])

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true); setMessage(null)
    try { await fn(); if (done) setMessage(done); await load(); onChanged() } catch (e) { setMessage((e as Error).message); await load() } finally { setBusy(false) }
  }
  const patch = (body: Record<string, unknown>) => run(() => api(`/${id}`, { method: 'PATCH', body }))
  if (!data) return <Card><CardContent className="py-8 text-sm text-slate-500">{message ?? 'Loading…'}</CardContent></Card>
  const t = data.ticket

  return (
    <Card>
      <CardHeader>
        <p className="font-mono text-xs text-slate-400">#{t.id} · {SOURCE_LABEL[t.source as TicketSource] ?? t.source} · opened {when(t.createdAt)}</p>
        <CardTitle className="mt-1">{t.subject}</CardTitle>
        {t.source === 'private_report' && <p className="mt-1 text-xs font-semibold text-rose-700">Private / confidential report: do not forward or publish.</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Select label="Status" value={t.status} onChange={(status) => patch({ status })} options={opts(TICKET_STATUSES, STATUS_LABEL)} />
          <Select label="Priority" value={t.priority} onChange={(priority) => patch({ priority })} options={opts(TICKET_PRIORITIES)} />
          <Select label="Category" value={t.category} onChange={(category) => patch({ category })} options={opts(TICKET_CATEGORIES)} />
          <Input label="Due" type="date" value={t.dueAt?.slice(0, 10) ?? ''}
            onChange={(e) => patch({ dueAt: e.target.value ? new Date(`${e.target.value}T17:00:00`).toISOString() : null })} />
        </div>
        <ContactFields key={`${t.contactName}|${t.contactEmail}|${t.organisation}`} ticket={t} onSave={patch} busy={busy} />

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{t.body || '(no message text)'}</p>
        </div>

        <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
          {data.events.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="text-xs text-slate-500">
                {when(e.createdAt)} · {e.actor} · <b className={cn(e.kind === 'reply' ? 'text-emerald-700' : e.kind === 'note' ? 'text-amber-700' : 'text-slate-600')}>
                  {e.kind === 'created' ? 'opened the ticket' : e.kind === 'note' ? 'internal note' : e.kind === 'reply' ? 'emailed a reply' : 'changed'}</b>
                {e.kind === 'reply' && e.emailStatus !== 'accepted' && <span className="ml-1 font-semibold text-rose-700">(not sent: {e.emailStatus})</span>}
              </p>
              {e.body && <p className="mt-0.5 whitespace-pre-wrap text-slate-800">{e.body}</p>}
            </li>
          ))}
        </ol>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Internal note <span className="font-normal text-slate-500">(never sent)</span>
              <textarea rows={4} className={cn(textarea, 'mt-1')} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <Button variant="outline" size="sm" disabled={busy || !note.trim()} onClick={() => run(async () => { await api(`/${id}/notes`, { method: 'POST', body: { body: note } }); setNote('') })}>Add note</Button>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Reply by email <span className="font-normal text-slate-500">{t.contactEmail ? `to ${t.contactEmail}` : '(add a contact email first)'}</span>
              <textarea rows={4} className={cn(textarea, 'mt-1')} value={reply} disabled={!t.contactEmail} onChange={(e) => setReply(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy || !reply.trim() || !t.contactEmail} onClick={() => run(async () => { await api(`/${id}/reply`, { method: 'POST', body: { body: reply } }); setReply('') }, 'Reply sent. The ticket is now waiting on them.')}>Send</Button>
              <Button variant="outline" size="sm" disabled={busy || !reply.trim() || !t.contactEmail} onClick={() => run(async () => { await api(`/${id}/reply`, { method: 'POST', body: { body: reply, status: 'resolved' } }); setReply('') }, 'Reply sent and the ticket resolved.')}>Send and resolve</Button>
            </div>
          </div>
        </div>
        {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
      </CardContent>
    </Card>
  )
}

function ContactFields({ ticket, onSave, busy }: { ticket: Detail; onSave: (b: Record<string, unknown>) => void; busy: boolean }) {
  const [c, setC] = useState({ contactName: ticket.contactName, contactEmail: ticket.contactEmail, organisation: ticket.organisation })
  const dirty = c.contactName !== ticket.contactName || c.contactEmail !== ticket.contactEmail || c.organisation !== ticket.organisation
  return (
    <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <Input label="Name" value={c.contactName} onChange={(e) => setC({ ...c, contactName: e.target.value })} />
      <Input label="Email" type="email" value={c.contactEmail} onChange={(e) => setC({ ...c, contactEmail: e.target.value })} />
      <Input label="Organisation" value={c.organisation} onChange={(e) => setC({ ...c, organisation: e.target.value })} />
      <Button variant="outline" size="sm" disabled={busy || !dirty} onClick={() => onSave(c)}>Save contact</Button>
    </div>
  )
}
