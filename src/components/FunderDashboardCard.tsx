import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from './ui'

type FunderValidation = {
  id: string; organization: string; framework: string; statusLabel: string
  progress: { done: number; total: number }; nextFollowUp: string | null
  notes: Array<{ firmId: string; note: string; updatedAt: string | null }>
}

export function FunderDashboardCard({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState<FunderValidation[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    if (!enabled) return
    const abort = new AbortController()
    fetch('/api/validations/funder', { cache: 'no-store', signal: abort.signal }).then(async response => {
      if (response.status === 403) {
        const body: { code?: string } = await response.json()
        if (body.code === 'SPECIALIZED_READ_ONLY') return []
      }
      if (!response.ok) throw new Error(`Funding partner information could not be loaded (${response.status}).`)
      return response.json() as Promise<FunderValidation[]>
    }).then(setItems).catch(e => { if (!abort.signal.aborted) setError((e as Error).message) })
    return () => abort.abort()
  }, [enabled])
  if (!enabled || (!items.length && !error)) return null
  return <Card><CardHeader><CardTitle>Funding partner inputs</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-xs text-slate-500">Shared validation progress and your firm's notes are shown separately; they do not change assessment scores.</p>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {items.map(item => <div key={item.id} className="space-y-1 border-t pt-2 text-sm">
      <Link to="/validations/$id" params={{ id: item.id }} className="font-semibold text-emerald-700 underline">{item.organization} · {item.framework}</Link>
      <p>{item.statusLabel} · {item.progress.done} of {item.progress.total} actions complete{item.nextFollowUp ? ` · Follow-up ${item.nextFollowUp}` : ''}</p>
      {item.notes.filter(note => note.note).map(note => <p key={note.firmId}>Your firm's note{note.updatedAt ? ` (${new Date(note.updatedAt).toLocaleString()})` : ''}: {note.note}</p>)}
    </div>)}
  </CardContent></Card>
}
