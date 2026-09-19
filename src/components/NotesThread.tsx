import { useState } from 'react'
import { ChevronDown, Lock, MessageSquare, Send, Users } from 'lucide-react'
import { getViewLevel, type ViewLevel } from '../lib/data'
import { fetchResponseNotes, postResponseNote, type ResponseNote } from '../lib/api'
import { Button } from './ui'
import { cn } from '../lib/utils'

// ============================================================================
// NotesThread — threaded, multi-author rationale for one assessment answer.
// ----------------------------------------------------------------------------
// Additive: it slots below a question's scoring controls and never blocks
// scoring. For a live workspace it reads/writes the /api/response-notes endpoint,
// which enforces privacy server-side (a read returns only the caller's own notes
// plus notes explicitly shared; the author is set from the verified session).
// Demo sessions keep their notes in memory only, consistent with the rest of the
// demo experience — they never touch the database or a real identity.
// ============================================================================

interface NotesThreadProps {
  orgId: string
  questionId: string
  currentUserEmail: string
  currentUserRole: ViewLevel
  isDemo: boolean
}

function RoleBadge({ role }: { role: string }) {
  const meta = getViewLevel(role as ViewLevel)
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', meta.badge.bg, meta.badge.text)}>
      {meta.short}
    </span>
  )
}

export function NotesThread({ orgId, questionId, currentUserEmail, currentUserRole, isDemo }: NotesThreadProps) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [notes, setNotes] = useState<ResponseNote[]>([])
  const [draft, setDraft] = useState('')
  const [shared, setShared] = useState(false)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    const next = !open
    setOpen(next)
    // Live workspaces hydrate the thread from the database the first time it is
    // opened; demo threads start empty and live purely in memory.
    if (next && !loaded && !isDemo) {
      setLoaded(true)
      const rows = await fetchResponseNotes(orgId, questionId)
      setNotes(rows)
    } else if (next && !loaded) {
      setLoaded(true)
    }
  }

  async function addNote() {
    const body = draft.trim()
    if (!body || busy) return
    const visibility: 'private' | 'shared' = shared ? 'shared' : 'private'
    setBusy(true)
    try {
      if (isDemo) {
        // In-memory only — never persisted, never attributed to a real identity.
        const local: ResponseNote = {
          id: Date.now(),
          questionId,
          authorEmail: currentUserEmail,
          authorName: currentUserEmail,
          authorRole: currentUserRole,
          body,
          visibility,
          createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        }
        setNotes(prev => [...prev, local])
      } else {
        const saved = await postResponseNote({ orgId, questionId, body, visibility })
        if (saved) setNotes(prev => [...prev, saved])
      }
      setDraft('')
      setShared(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
          Notes &amp; rationale
          {notes.length > 0 && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
              {notes.length}
            </span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {loaded && notes.length === 0 && (
            <p className="text-xs text-slate-400">
              No notes yet. Add the reasoning behind this score — private to you unless you choose to share it.
            </p>
          )}

          {notes.map(n => (
            <div key={n.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">{n.authorName || n.authorEmail}</span>
                <RoleBadge role={n.authorRole} />
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    n.visibility === 'shared'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-600',
                  )}
                >
                  {n.visibility === 'shared' ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {n.visibility === 'shared' ? 'Shared' : 'Private'}
                </span>
                <span className="ml-auto font-mono text-[10px] text-slate-400">{n.createdAt}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>
            </div>
          ))}

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={2}
              placeholder="Add a note explaining this score…"
              className="w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={shared}
                  onChange={e => setShared(e.target.checked)}
                  className="h-3.5 w-3.5 accent-emerald-600"
                />
                {shared ? (
                  <span className="flex items-center gap-1 font-medium text-emerald-700">
                    <Users className="h-3.5 w-3.5" /> Share with the team
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" /> Private to you
                  </span>
                )}
              </label>
              <Button size="sm" onClick={addNote} disabled={!draft.trim() || busy}>
                <Send className="h-3.5 w-3.5" /> {busy ? 'Adding…' : 'Add note'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
