import { useEffect, useState, type FormEvent } from 'react'

// The signed-in person's inbox: the notifications CRAFT emailed them (readable here even if the email
// never arrived) and messages from the people they work with.
type Message = { id: number; kind: string; subject: string; body: string; createdAt: string; readAt: string | null; sender: string | null }
type Contact = { email: string; name: string }

const post = (body: object) => fetch('/api/inbox', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const markRead = (id?: number) => post(id ? { id } : {})

// Message text is plain text; links in it are made clickable, nothing else is interpreted.
const withLinks = (text: string) =>
  text.split(/(https?:\/\/[^\s<>"]+)/g).map((part, i) =>
    i % 2 ? <a key={i} href={part} className="break-all text-emerald-700 underline">{part}</a> : part)

const field = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'

export function InboxPage() {
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  // The message being written (null = form closed).
  const [draft, setDraft] = useState<{ to: string; subject: string; body: string } | null>(null)
  const [sendState, setSendState] = useState<{ busy?: boolean; error?: string; sent?: string }>({})

  useEffect(() => {
    fetch('/api/inbox').then(async (r) => {
      if (!r.ok) throw new Error(String(r.status))
      setMessages((await r.json()).messages)
    }).catch(() => setError('Your inbox could not be loaded. Check your connection and reload the page.'))
    fetch('/api/inbox?contacts=1').then((r) => (r.ok ? r.json() : null)).then((d) => setContacts(d?.contacts ?? []), () => {})
  }, [])

  const setReadLocally = (id?: number) => setMessages((ms) => ms && ms.map((m) => (!id || m.id === id) && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m))
  const toggle = (m: Message) => {
    setOpen(open === m.id ? null : m.id)
    if (!m.readAt) { setReadLocally(m.id); void markRead(m.id) }
  }
  const unread = messages?.filter((m) => !m.readAt).length ?? 0
  const nameOf = (email: string) => contacts.find((c) => c.email === email)?.name ?? email

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    setSendState({ busy: true })
    try {
      const r = await post(draft)
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || 'The message could not be sent.')
      setSendState({ sent: `Message sent to ${nameOf(draft.to)}.` })
      setDraft(null)
    } catch (err) {
      setSendState({ error: err instanceof Error ? err.message : 'The message could not be sent.' })
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inbox</h1>
          <p className="mt-1 text-sm text-slate-600">Everything CRAFT emails you is kept here too, along with messages from the people you work with.</p>
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <button type="button" onClick={() => { setReadLocally(); void markRead() }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Mark all as read
            </button>
          )}
          {contacts.length > 0 && !draft && (
            <button type="button" onClick={() => { setDraft({ to: contacts[0].email, subject: '', body: '' }); setSendState({}) }} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800">
              New message
            </button>
          )}
        </div>
      </div>

      {sendState.sent && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{sendState.sent}</p>}
      {draft && (
        <form onSubmit={send} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-medium text-slate-600">To
            <select value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={field}>
              {contacts.map((c) => <option key={c.email} value={c.email}>{c.name === c.email ? c.email : `${c.name} (${c.email})`}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">Subject
            <input required maxLength={200} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className={field} />
          </label>
          <label className="block text-xs font-medium text-slate-600">Message
            <textarea required maxLength={5000} rows={5} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className={field} />
          </label>
          {sendState.error && <p role="alert" className="text-sm text-rose-700">{sendState.error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={sendState.busy} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{sendState.busy ? 'Sending…' : 'Send'}</button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
          <p className="text-xs text-slate-500">You can message people you already work with on CRAFT. They also get it by email.</p>
        </form>
      )}

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {!error && messages === null && <p className="text-sm text-slate-500">Loading…</p>}
      {messages?.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No messages yet. Invitations, reminders, notices and messages will appear here.</p>}
      <ul className="space-y-2">
        {messages?.map((m) => (
          <li key={m.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <button type="button" aria-expanded={open === m.id} onClick={() => toggle(m)} className="flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left">
              <span className={m.readAt ? 'text-slate-700' : 'font-semibold text-slate-900'}>
                {!m.readAt && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-600" role="img" aria-label="Unread" />}
                {m.subject}
                <span className="block text-xs font-normal text-slate-500">{m.sender ? `From ${nameOf(m.sender)}` : 'CRAFT notification'}</span>
              </span>
              <time className="shrink-0 text-xs text-slate-500" dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</time>
            </button>
            {open === m.id && (
              <div className="border-t border-slate-100 px-4 py-3">
                <p className="whitespace-pre-wrap text-sm text-slate-700">{withLinks(m.body)}</p>
                {m.sender && contacts.some((c) => c.email === m.sender) && (
                  <button type="button" onClick={() => { setDraft({ to: m.sender!, subject: m.subject.startsWith('Re: ') ? m.subject : `Re: ${m.subject}`.slice(0, 200), body: '' }); setSendState({}); window.scrollTo({ top: 0 }) }}
                    className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Reply</button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
