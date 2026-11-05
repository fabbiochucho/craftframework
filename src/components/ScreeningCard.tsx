// Exclusion, debarment and sanctions screening. Free official lists (UN, US, EU, UK) are matched inside CRAFT; clear
// cases are settled by written automatic rules (shown, and a person can overturn them); ambiguous ones wait for a
// person. Debarment lists with no free download are checked by a person and recorded here.
import { useCallback, useEffect, useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from './ui'
import { INVESTIGATION_AIDS, listName, MANUAL_LISTS, type SubjectType } from '../lib/screening'

type Match = { caption: string; matchedName?: string; score: number; datasets: string[]; countries?: string[]; birthYears?: number[]; decision?: string; rule?: string }
type Row = { id: string; subjectName: string; subjectType: string; provider: string; status: string; matches: Match[]; checkedAt: string; checkedBy: string; review: string; reviewNote: string; reviewedBy: string | null }
type View = { provider: string; ready: boolean; lists: { source: string; fetchedAt: string | null; count: number }[]; state: string; results: Row[] }
type Subj = { name: string; type: SubjectType; country: string; birthYear: string; registrationNumber: string }

const STATE_TEXT: Record<string, string> = {
  not_screened: 'Not screened yet.', clear: 'Clear: no unresolved matches.', needs_review: 'Some possible matches need a person to decide.', confirmed_match: 'A confirmed match: do not proceed without legal and funder advice.',
}
const SOURCE_TEXT: Record<string, string> = { un: 'UN Security Council', ofac: 'US OFAC', eu: 'EU', uk: 'UK Sanctions List' }

async function call<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/screening${path}`, init && { method: init.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(init.body) })
  const body = await res.json().catch(() => ({})) as T & { error?: string }
  if (!res.ok && res.status !== 502) throw new Error(body.error === 'mfa_required' ? 'Confirm your two-step sign-in, then try again.' : body.error ?? `Request failed (${res.status})`)
  return body
}

export function ScreeningCard({ orgId, orgName, awardId }: { orgId: string; orgName: string; awardId?: string }) {
  const [view, setView] = useState<View | null>(null)
  const [subjects, setSubjects] = useState<Subj[]>([{ name: orgName, type: 'organisation', country: '', birthYear: '', registrationNumber: '' }])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [manual, setManual] = useState({ subjectName: orgName, subjectType: 'organisation' as SubjectType, list: 'worldbank', result: 'clear', note: '' })
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(async () => { try { setView(await call(`?orgId=${encodeURIComponent(orgId)}`)) } catch (e) { setMsg((e as Error).message) } }, [orgId])
  useEffect(() => { void load() }, [load])
  const set = (i: number, patch: Partial<Subj>) => setSubjects(subjects.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  const run = async () => {
    setMsg(null)
    try {
      const body = subjects.filter((s) => s.name.trim()).map((s) => ({
        name: s.name, type: s.type, ...(s.country ? { country: s.country } : {}), ...(s.birthYear ? { birthYear: Number(s.birthYear) } : {}), ...(s.registrationNumber ? { registrationNumber: s.registrationNumber } : {}),
      }))
      const r = await call<{ results: Row[] }>('', { method: 'POST', body: { orgId, awardId: awardId ?? null, subjects: body } })
      setMsg(r.results.some((x) => x.status === 'error') ? 'Some names could not be checked; try again later.' : 'Screening complete.')
      await load()
    } catch (e) { setMsg((e as Error).message) }
  }
  const review = async (id: string, decision: 'confirmed_match' | 'false_positive') => {
    try { await call(`/${id}`, { method: 'PUT', body: { review: decision, note: notes[id] ?? '' } }); await load() } catch (e) { setMsg((e as Error).message) }
  }
  const recordManual = async () => {
    try { await call('/manual', { method: 'POST', body: { orgId, awardId: awardId ?? null, ...manual } }); setManual({ ...manual, note: '' }); await load() } catch (e) { setMsg((e as Error).message) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exclusion, debarment and sanctions screening</CardTitle>
        <p className="text-sm text-slate-500">Free official sanctions lists are checked inside CRAFT (names are not sent anywhere). Clear cases are decided by written rules, shown with each result; you can overturn any of them. Similar names with nothing else to go on wait for a person.</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {view && (
          <p className="text-xs text-slate-500">Lists: {view.lists.map((l) => `${SOURCE_TEXT[l.source] ?? l.source} ${l.count ? `(${l.count.toLocaleString()}, ${new Date(l.fetchedAt!).toLocaleDateString()})` : '(downloading)'}`).join(' · ')}{view.provider === 'opensanctions' && ' · using OpenSanctions'}</p>
        )}
        {view && <p><b>Status:</b> {STATE_TEXT[view.state] ?? view.state}</p>}

        <div className="space-y-2">
          {subjects.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_9rem_5rem_6rem_9rem_auto] sm:items-end">
              <Input label={i === 0 ? 'Name' : ''} value={s.name} onChange={(e) => set(i, { name: e.target.value })} />
              <Select value={s.type} onChange={(type) => set(i, { type: type as SubjectType })} options={[{ value: 'organisation', label: 'Organisation' }, { value: 'person', label: 'Person' }]} />
              <Input label={i === 0 ? 'Country' : ''} placeholder="KE" maxLength={2} value={s.country} onChange={(e) => set(i, { country: e.target.value })} />
              <Input label={i === 0 ? 'Birth year' : ''} placeholder={s.type === 'person' ? '1975' : '–'} disabled={s.type !== 'person'} value={s.birthYear} onChange={(e) => set(i, { birthYear: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
              <Input label={i === 0 ? 'Registration / ID no.' : ''} value={s.registrationNumber} onChange={(e) => set(i, { registrationNumber: e.target.value })} />
              <Button size="sm" variant="ghost" onClick={() => setSubjects(subjects.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
          <p className="text-xs text-slate-500">Country, birth year and registration or ID number let the rules settle more results without a person.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={subjects.length >= 20} onClick={() => setSubjects([...subjects, { name: '', type: 'person', country: '', birthYear: '', registrationNumber: '' }])}>Add a name</Button>
            <Button size="sm" disabled={!view?.ready || !subjects.some((s) => s.name.trim().length >= 2)} onClick={() => void run()}>Run screening</Button>
          </div>
          {view && !view.ready && <p className="text-amber-700">The sanctions lists are being downloaded for the first time; try again in a few minutes.</p>}
          {msg && <p role="status">{msg}</p>}
        </div>

        {view && view.results.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {view.results.map((r) => (
              <li key={r.id} className="py-2">
                <p><b>{r.subjectName}</b> ({r.subjectType}) · {r.provider.startsWith('manual:') ? `${MANUAL_LISTS.find((l) => `manual:${l.id}` === r.provider)?.name ?? r.provider}, checked by ${r.checkedBy}` : 'sanctions lists'} · {new Date(r.checkedAt).toLocaleDateString()} · <b>{r.status === 'clear' ? 'clear' : r.status === 'error' ? 'not checked (error)' : r.review === 'confirmed_match' ? 'confirmed match' : r.review === 'false_positive' ? 'dismissed' : 'needs a person'}</b>
                  {r.reviewedBy && <span className="text-xs text-slate-500"> · decided by {r.reviewedBy}</span>}</p>
                {r.matches.length > 0 && <ul className="mt-1 list-disc pl-5 text-slate-700">{r.matches.map((m, i) => (
                  <li key={i}>{m.matchedName ?? m.caption} · {m.datasets.map(listName).join(', ')} · score {m.score.toFixed(2)}{m.countries?.length ? ` · ${m.countries.join(', ')}` : ''}{m.birthYears?.length ? ` · born ${m.birthYears.join('/')}` : ''}{m.rule && <span className="text-slate-500"> · {m.rule}</span>}</li>
                ))}</ul>}
                {r.reviewNote && <p className="text-xs text-slate-500">{r.reviewNote}</p>}
                {r.status === 'possible_match' && (!r.review || r.reviewedBy?.startsWith('system')) && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                    <Input label={r.review ? 'Overturn the automatic decision: your reason' : 'Your decision: reason'} value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                    <Button size="sm" variant="outline" disabled={(notes[r.id] ?? '').trim().length < 3} onClick={() => void review(r.id, 'false_positive')}>Not the same</Button>
                    <Button size="sm" variant="destructive" disabled={(notes[r.id] ?? '').trim().length < 3} onClick={() => void review(r.id, 'confirmed_match')}>Confirmed match</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <p className="font-medium">Debarment lists to check by hand</p>
          <p className="text-xs text-slate-500">These lists have no free download or open data feed, so a person searches them and records the result here.</p>
          <ul className="list-disc pl-5">{MANUAL_LISTS.map((l) => <li key={l.id}><a className="text-emerald-700 underline" href={l.url} target="_blank" rel="noopener noreferrer">{l.name}</a></li>)}</ul>
          <div className="grid gap-2 sm:grid-cols-[1fr_9rem_12rem_8rem] sm:items-end">
            <Input label="Name checked" value={manual.subjectName} onChange={(e) => setManual({ ...manual, subjectName: e.target.value })} />
            <Select value={manual.subjectType} onChange={(v) => setManual({ ...manual, subjectType: v as SubjectType })} options={[{ value: 'organisation', label: 'Organisation' }, { value: 'person', label: 'Person' }]} />
            <Select value={manual.list} onChange={(list) => setManual({ ...manual, list })} options={MANUAL_LISTS.map((l) => ({ value: l.id, label: l.name }))} />
            <Select value={manual.result} onChange={(result) => setManual({ ...manual, result })} options={[{ value: 'clear', label: 'Not listed' }, { value: 'found', label: 'Listed' }]} />
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Input label="Note (date searched, what you saw)" value={manual.note} onChange={(e) => setManual({ ...manual, note: e.target.value })} />
            <Button size="sm" variant="outline" disabled={manual.note.trim().length < 3 || manual.subjectName.trim().length < 2} onClick={() => void recordManual()}>Record check</Button>
          </div>
        </div>

        <p className="text-xs text-slate-500">To dig deeper (these are investigation aids, not lists; a result there is never a finding on its own): {INVESTIGATION_AIDS.map((a, i) => <span key={a.name}>{i > 0 && ' · '}<a className="text-emerald-700 underline" href={a.url(subjects[0]?.name || orgName)} target="_blank" rel="noopener noreferrer">{a.name}</a></span>)}</p>
      </CardContent>
    </Card>
  )
}
