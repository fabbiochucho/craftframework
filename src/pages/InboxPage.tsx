import { useEffect, useState } from 'react'

// The notifications CRAFT emailed to the signed-in person, readable here even if the email never arrived.
type Message = { id: number; kind: string; subject: string; body: string; createdAt: string; readAt: string | null }

const markRead = (id?: number) =>
  fetch('/api/inbox', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(id ? { id } : {}) })

// Message text is plain text; links in it are made clickable, nothing else is interpreted.
const withLinks = (text: string) =>
  text.split(/(https?:\/\/[^\s<>"]+)/g).map((part, i) =>
    i % 2 ? <a key={i} href={part} className="break-all text-emerald-700 underline">{part}</a> : part)

export function InboxPage() {
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/inbox').then(async (r) => {
      if (!r.ok) throw new Error(String(r.status))
      setMessages((await r.json()).messages)
    }).catch(() => setError('Your inbox could not be loaded. Check your connection and reload the page.'))
  }, [])

  const setReadLocally = (id?: number) => setMessages((ms) => ms && ms.map((m) => (!id || m.id === id) && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m))
  const toggle = (m: Message) => {
    setOpen(open === m.id ? null : m.id)
    if (!m.readAt) { setReadLocally(m.id); void markRead(m.id) }
  }
  const unread = messages?.filter((m) => !m.readAt).length ?? 0

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inbox</h1>
          <p className="mt-1 text-sm text-slate-600">Everything CRAFT emails you is kept here too, so nothing is missed if an email does not arrive.</p>
        </div>
        {unread > 0 && (
          <button type="button" onClick={() => { setReadLocally(); void markRead() }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Mark all as read
          </button>
        )}
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {!error && messages === null && <p className="text-sm text-slate-500">Loading…</p>}
      {messages?.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No messages yet. Invitations, reminders and other notices will appear here.</p>}
      <ul className="space-y-2">
        {messages?.map((m) => (
          <li key={m.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <button type="button" aria-expanded={open === m.id} onClick={() => toggle(m)} className="flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left">
              <span className={m.readAt ? 'text-slate-700' : 'font-semibold text-slate-900'}>
                {!m.readAt && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-600" role="img" aria-label="Unread" />}
                {m.subject}
              </span>
              <time className="shrink-0 text-xs text-slate-500" dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</time>
            </button>
            {open === m.id && <p className="whitespace-pre-wrap border-t border-slate-100 px-4 py-3 text-sm text-slate-700">{withLinks(m.body)}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
