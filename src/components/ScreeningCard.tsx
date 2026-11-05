// Exclusion, debarment and sanctions screening: run names against the lists, then a person reviews each possible match.
// Nothing is decided automatically. Rules in src/lib/screening.ts; /api/screening enforces access.
import { useCallback, useEffect, useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from './ui'
import { listName, type SubjectType } from '../lib/screening'

type Row = { id: string; subjectName: string; subjectType: string; status: string; matches: { caption: string; score: number; datasets: string[] }[]; checkedAt: string; review: string; reviewNote: string; reviewedBy: string | null }
const STATE_TEXT: Record<string, string> = {
  not_screened: 'Not screened yet.', clear: 'Clear: no unresolved matches.', needs_review: 'Possible matches need a person to review them.', confirmed_match: 'A confirmed match: do not proceed without legal and funder advice.',
}

async function call<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/screening${path}`, init && { method: init.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(init.body) })
  const body = await res.json().catch(() => ({})) as T & { error?: string }
  if (!res.ok && res.status !== 502) throw new Error(body.error === 'mfa_required' ? 'Confirm your two-step sign-in, then try again.' : body.error ?? `Request failed (${res.status})`)
  return body
}

export function ScreeningCard({ orgId, orgName, awardId }: { orgId: string; orgName: string; awardId?: string }) {
  const [view, setView] = useState<{ configured: boolean; state: string; results: Row[] } | null>(null)
  const [subjects, setSubjects] = useState<{ name: string; type: SubjectType }[]>([{ name: orgName, type: 'organisation' }])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(async () => { try { setView(await call(`?orgId=${encodeURIComponent(orgId)}`)) } catch (e) { setMsg((e as Error).message) } }, [orgId])
  useEffect(() => { void load() }, [load])
  const run = async () => {
    setMsg(null)
    try {
      const r = await call<{ results: Row[] }>('', { method: 'POST', body: { orgId, awardId: awardId ?? null, subjects: subjects.filter((s) => s.name.trim()) } })
      setMsg(r.results.some((x) => x.status === 'error') ? 'The screening service did not respond for some names; try again later.' : 'Screening complete.')
      await load()
    } catch (e) { setMsg((e as Error).message) }
  }
  const review = async (id: string, decision: 'confirmed_match' | 'false_positive') => {
    try { await call(`/${id}`, { method: 'PUT', body: { review: decision, note: notes[id] ?? '' } }); await load() } catch (e) { setMsg((e as Error).message) }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Exclusion, debarment and sanctions screening</CardTitle>
        <p className="text-sm text-slate-500">Checks the organisation, its leaders and its partners against the World Bank, AfDB, ADB, IDB and EBRD debarment lists, US SAM exclusions and UN, US, EU and UK sanctions. A possible match is not a finding: a person must review it and record the decision.</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {view && !view.configured && <p className="rounded bg-amber-50 p-2 text-amber-800">Screening is not switched on yet. Until it is, record your own checks as evidence in the Pre-Award statements.</p>}
        {view && <p><b>Status:</b> {STATE_TEXT[view.state] ?? view.state}</p>}
        {subjects.map((s, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
            <Input label={i === 0 ? 'Name' : ''} value={s.name} onChange={(e) => setSubjects(subjects.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Select value={s.type} onChange={(type) => setSubjects(subjects.map((x, j) => (j === i ? { ...x, type: type as SubjectType } : x)))} options={[{ value: 'organisation', label: 'Organisation' }, { value: 'person', label: 'Person' }]} />
            <Button size="sm" variant="ghost" onClick={() => setSubjects(subjects.filter((_, j) => j !== i))}>Remove</Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={subjects.length >= 20} onClick={() => setSubjects([...subjects, { name: '', type: 'person' }])}>Add a name</Button>
          <Button size="sm" disabled={!view?.configured || !subjects.some((s) => s.name.trim().length >= 2)} onClick={() => void run()}>Run screening</Button>
        </div>
        {msg && <p role="status">{msg}</p>}
        {view && view.results.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {view.results.map((r) => (
              <li key={r.id} className="py-2">
                <p><b>{r.subjectName}</b> ({r.subjectType}) · {new Date(r.checkedAt).toLocaleDateString()} · {r.status === 'clear' ? 'clear' : r.status === 'error' ? 'not checked (service error)' : r.review ? (r.review === 'confirmed_match' ? 'confirmed match' : 'false positive') : 'possible match, needs review'}</p>
                {r.matches.length > 0 && <ul className="mt-1 list-disc pl-5 text-slate-700">{r.matches.map((m, i) => <li key={i}>{m.caption} · score {m.score.toFixed(2)} · {m.datasets.map(listName).join(', ')}</li>)}</ul>}
                {r.review && <p className="text-xs text-slate-500">Reviewed by {r.reviewedBy}: {r.reviewNote}</p>}
                {r.status === 'possible_match' && !r.review && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                    <Input label="Reason for your decision" value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                    <Button size="sm" variant="outline" disabled={(notes[r.id] ?? '').trim().length < 3} onClick={() => void review(r.id, 'false_positive')}>False positive</Button>
                    <Button size="sm" variant="destructive" disabled={(notes[r.id] ?? '').trim().length < 3} onClick={() => void review(r.id, 'confirmed_match')}>Confirmed match</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
