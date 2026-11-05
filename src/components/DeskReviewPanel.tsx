// Desk review: the evidence request list (documents, custodians, due dates, statuses) and the fieldwork log behind a
// Capacity Assessment. Requirements come from src/lib/dataroom.ts; records are saved by /api/desk-review.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from './ui'
import { cn } from '../lib/utils'
import { useAuthCtx } from '../lib/context'
import { ARCHETYPES, type Archetype } from '../lib/data'
import {
  approvedForReview, computeProgress, countryCode, generateChecklist, requestListCsv, requirementsByCategory, RECENT_APPROVAL_DAYS,
  SECTORS_BY_ARCHETYPE, STATUS_META, PRIORITY_META, statusOf, type ComplianceRequirement, type DataRoomItem, type DataRoomStatus,
} from '../lib/dataroom'
import type { CcaModule } from '../lib/cca/engine'

export type DeskRow = {
  requirementId: string; status: DataRoomStatus; evidenceRef: string; approvedOn: string | null; evidenceOfUse: string; notAvailableReason: string
  custodian: string; dueDate: string | null; assessorNote: string; providedBy: string | null; verifiedBy: string | null
}
type Fieldwork = { id: string; kind: string; heldOn: string; people: string; requirementId: string | null; summary: string; result: string; recordedBy: string }
type Profile = { archetype: string | null; sector: string | null; subsector: string | null; country: string } | null
export type DeskData = { profile: Profile; items: DeskRow[]; fieldwork: Fieldwork[] }

async function api<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/desk-review${path}`, init && { method: init.method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(init.body) })
  const body = await res.json().catch(() => ({})) as T & { error?: string }
  if (!res.ok) throw new Error(body.error === 'mfa_required' ? 'Confirm your two-step sign-in, then try again.' : body.error ?? `Request failed (${res.status})`)
  return body
}

/** The organisation's desk review, loaded once and reloadable. */
export function useDeskReview(orgId: string) {
  const [data, setData] = useState<DeskData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!orgId) return
    try { setData(await api<DeskData>(`?orgId=${encodeURIComponent(orgId)}`)); setError(null) } catch (e) { setError((e as Error).message) }
  }, [orgId])
  useEffect(() => { void load() }, [load])
  return { data, error, load }
}

const asItems = (rows: DeskRow[]): Record<string, DataRoomItem> => Object.fromEntries(rows.map((r) => [r.requirementId, {
  requirementId: r.requirementId, documentName: '', status: r.status, fileUrl: r.evidenceRef, approvedOn: r.approvedOn ?? undefined,
  evidenceOfUse: r.evidenceOfUse, notAvailableReason: r.notAvailableReason, custodian: r.custodian, dueDate: r.dueDate ?? undefined,
  assessorNote: r.assessorNote, providedBy: r.providedBy ?? undefined, verifiedBy: r.verifiedBy ?? undefined,
} satisfies DataRoomItem]))

/** The checklist for the organisation's profile, with local overrides when the profile is incomplete. */
export function deskRequirements(profile: Profile, override?: { archetype: string; sector: string }): ComplianceRequirement[] {
  const archetype = (override?.archetype || profile?.archetype || '') as Archetype | ''
  return generateChecklist(archetype, countryCode(profile?.country ?? ''), override?.sector || profile?.sector || '', profile?.subsector ?? '')
}

const today = () => new Date().toISOString().slice(0, 10)
const KINDS = [{ value: 'interview', label: 'Interview' }, { value: 'walkthrough', label: 'Walkthrough' }, { value: 'sample_test', label: 'Sample test' }, { value: 'site_visit', label: 'Site visit' }]

export function DeskReviewPanel({ orgId, modules }: { orgId: string; modules: CcaModule[] }) {
  const { currentUser } = useAuthCtx()
  const { data, error, load } = useDeskReview(orgId)
  const [override, setOverride] = useState({ archetype: '', sector: '' })
  const [reviewDate, setReviewDate] = useState(today())
  const [open, setOpen] = useState<{ id: string; mode: 'provide' | 'absent' | 'flag' } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const reqs = useMemo(() => deskRequirements(data?.profile ?? null, override), [data, override])
  const items = useMemo(() => asItems(data?.items ?? []), [data])
  const progress = computeProgress(reqs, items)
  const domainNames = useMemo(() => {
    const out = new Map<string, string>()
    for (const m of modules) for (const a of m.areas) for (const d of a.domains) out.set(m.id === 'community' ? d.id : `gov:${d.id.replace(/^[a-z]+-/, '')}`, d.name)
    return out
  }, [modules])

  const save = async (id: string, body: Record<string, unknown>, done?: string) => {
    try { await api(`/items/${id}`, { method: 'PUT', body: { orgId, ...body } }); setOpen(null); setMsg(done ?? null); await load() } catch (e) { setMsg((e as Error).message) }
  }
  const download = () => {
    const blob = new Blob([requestListCsv(reqs, items)], { type: 'text/csv' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `desk-review-request-list-${reviewDate}.csv` })
    a.click(); URL.revokeObjectURL(a.href)
  }

  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>
  const needsProfile = !data.profile?.archetype || !data.profile?.sector

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Desk review</CardTitle>
          <p className="text-sm text-slate-500">The documents the organisation should hold, who holds them and when they are due. Provide the approved version with evidence it is used. If a document does not exist, say so and why: do not write one just for the review. Documents approved within {RECENT_APPROVAL_DAYS} days before the review date are marked for the assessor to check.</p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-4">
            {needsProfile && <>
              <Select label="Organisation type" placeholder="Choose" value={override.archetype || data.profile?.archetype || ''} onChange={(v) => setOverride({ archetype: v, sector: '' })} options={ARCHETYPES.map((a) => ({ value: a.id, label: a.label }))} />
              <Select label="Sector" placeholder="Choose" value={override.sector || data.profile?.sector || ''} onChange={(v) => setOverride({ ...override, sector: v })}
                options={(SECTORS_BY_ARCHETYPE[(override.archetype || data.profile?.archetype) as Archetype] ?? []).map((s) => ({ value: s, label: s }))} />
            </>}
            <Input label="Review date" type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
            <div className="self-end"><Button size="sm" variant="outline" disabled={!reqs.length} onClick={download}>Download request list (CSV)</Button></div>
          </div>
          {needsProfile && <p className="text-xs text-slate-500">The organisation’s type or sector is not set in its profile; the choice here only changes this list.</p>}
          <p>{reqs.length} documents · provided {progress.provided} · verified {progress.verified} · flagged {progress.flagged} · does not exist {progress.notAvailable} · missing {progress.missing}</p>
          {msg && <p role="status">{msg}</p>}
        </CardContent>
      </Card>

      {requirementsByCategory(reqs).map((g) => (
        <Card key={g.category}>
          <CardHeader><CardTitle>{g.category}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {g.items.map((r) => {
              const it = items[r.id]
              const st = statusOf(it)
              const mine = it?.providedBy === currentUser?.email
              const feeds = [...(r.cca?.community ?? []).map((d) => domainNames.get(d)), ...(r.cca?.government ?? []).map((d) => domainNames.get(`gov:${d}`))].filter(Boolean)
              return (
                <div key={r.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{r.documentName}</p>
                    <span className={cn('rounded px-1.5 text-xs', PRIORITY_META[r.priority])}>{r.priority}</span>
                    <span className={cn('rounded-full border px-2 text-xs', STATUS_META[st].cls)}>{STATUS_META[st].label}</span>
                    {st !== 'not_available' && approvedForReview(it?.approvedOn, reviewDate) && <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-800">Approved within {RECENT_APPROVAL_DAYS} days of the review</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{r.description}{feeds.length > 0 && <> · Evidence for: {[...new Set(feeds)].join(', ')}</>}</p>
                  {it?.fileUrl && st !== 'not_available' && <p className="mt-1 text-xs">Held at: {/^https?:\/\//.test(it.fileUrl) ? <a className="text-emerald-700 underline" href={it.fileUrl} target="_blank" rel="noopener noreferrer">{it.fileUrl}</a> : it.fileUrl}{it.approvedOn && ` · approved ${it.approvedOn}`}{it.evidenceOfUse && ` · in use: ${it.evidenceOfUse}`}</p>}
                  {st === 'not_available' && <p className="mt-1 text-xs text-slate-700">Does not exist: {it?.notAvailableReason}</p>}
                  {it?.assessorNote && st === 'flagged' && <p className="mt-1 text-xs text-rose-700">Assessor: {it.assessorNote}</p>}
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
                    <Input label="Custodian (who holds it)" defaultValue={it?.custodian ?? ''} onBlur={(e) => e.target.value !== (it?.custodian ?? '') && void save(r.id, { status: st, custodian: e.target.value })} />
                    <Input label="Due date" type="date" defaultValue={it?.dueDate ?? ''} onBlur={(e) => e.target.value !== (it?.dueDate ?? '') && void save(r.id, { status: st, dueDate: e.target.value || null })} />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setOpen({ id: r.id, mode: 'provide' })}>{st === 'missing' || st === 'not_available' ? 'Provide' : 'Update'}</Button>
                      {st === 'missing' && <Button size="sm" variant="ghost" onClick={() => setOpen({ id: r.id, mode: 'absent' })}>Does not exist</Button>}
                      {(st === 'uploaded' || st === 'flagged' || st === 'verified') && !mine && <>
                        {st !== 'verified' && <Button size="sm" onClick={() => void save(r.id, { status: 'verified' }, 'Verified.')}>Verify</Button>}
                        <Button size="sm" variant="outline" className="text-rose-600" onClick={() => setOpen({ id: r.id, mode: 'flag' })}>Flag</Button>
                      </>}
                    </div>
                  </div>
                  {open?.id === r.id && <ItemForm mode={open.mode} item={it} onCancel={() => setOpen(null)} onSave={(body) => void save(r.id, body, 'Saved.')} />}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}

      <FieldworkLog orgId={orgId} entries={data.fieldwork} reqs={reqs} onSaved={load} />
    </div>
  )
}

function ItemForm({ mode, item, onCancel, onSave }: { mode: 'provide' | 'absent' | 'flag'; item?: DataRoomItem; onCancel: () => void; onSave: (body: Record<string, unknown>) => void }) {
  const [f, setF] = useState({ evidenceRef: item?.fileUrl ?? '', approvedOn: item?.approvedOn ?? '', evidenceOfUse: item?.evidenceOfUse ?? '', reason: '', note: '' })
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
      {mode === 'provide' && <>
        <Input label="Link, or where the document is held" value={f.evidenceRef} onChange={(e) => setF({ ...f, evidenceRef: e.target.value })} />
        <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
          <Input label="Approved on" type="date" value={f.approvedOn} onChange={(e) => setF({ ...f, approvedOn: e.target.value })} />
          <Input label="Evidence it is in use (minutes, records, examples)" value={f.evidenceOfUse} onChange={(e) => setF({ ...f, evidenceOfUse: e.target.value })} />
        </div>
      </>}
      {mode === 'absent' && <Input label="Why the document does not exist" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />}
      {mode === 'flag' && <Input label="What needs correcting" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />}
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm"
          disabled={mode === 'provide' ? f.evidenceRef.trim().length < 3 : mode === 'absent' ? f.reason.trim().length < 3 : f.note.trim().length < 3}
          onClick={() => onSave(mode === 'provide'
            ? { status: 'uploaded', evidenceRef: f.evidenceRef, approvedOn: f.approvedOn || null, evidenceOfUse: f.evidenceOfUse }
            : mode === 'absent' ? { status: 'not_available', notAvailableReason: f.reason } : { status: 'flagged', assessorNote: f.note })}>Save</Button>
      </div>
    </div>
  )
}

function FieldworkLog({ orgId, entries, reqs, onSaved }: { orgId: string; entries: Fieldwork[]; reqs: ComplianceRequirement[]; onSaved: () => Promise<void> }) {
  const blank = { kind: 'interview', heldOn: today(), people: '', requirementId: '', summary: '', result: '' }
  const [f, setF] = useState(blank)
  const [msg, setMsg] = useState<string | null>(null)
  const add = async () => {
    try {
      await api('/fieldwork', { method: 'POST', body: { orgId, ...f, requirementId: f.requirementId || undefined } })
      setF(blank); setMsg('Recorded.'); await onSaved()
    } catch (e) { setMsg((e as Error).message) }
  }
  const name = (id: string | null) => reqs.find((r) => r.id === id)?.documentName
  return (
    <Card>
      <CardHeader><CardTitle>Fieldwork log</CardTitle><p className="text-sm text-slate-500">Interviews, walkthroughs, sample tests and site visits. Entries are kept as recorded.</p></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-4">
          <Select label="Type" value={f.kind} onChange={(kind) => setF({ ...f, kind })} options={KINDS} />
          <Input label="Date" type="date" value={f.heldOn} onChange={(e) => setF({ ...f, heldOn: e.target.value })} />
          <Input label="People (roles)" value={f.people} onChange={(e) => setF({ ...f, people: e.target.value })} />
          <Select label="Document (optional)" placeholder="None" value={f.requirementId} onChange={(requirementId) => setF({ ...f, requirementId })} options={reqs.map((r) => ({ value: r.id, label: r.documentName }))} />
        </div>
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <Input label="What was done and found" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
          <Input label="Result" value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })} />
          <Button size="sm" disabled={f.summary.trim().length < 3} onClick={() => void add()}>Record</Button>
        </div>
        {msg && <p role="status">{msg}</p>}
        {entries.length > 0 && <ul className="divide-y divide-slate-100">{entries.map((e) => (
          <li key={e.id} className="py-2"><b>{KINDS.find((k) => k.value === e.kind)?.label}</b> · {e.heldOn}{e.people && ` · ${e.people}`}{e.requirementId && ` · ${name(e.requirementId) ?? e.requirementId}`}<br />{e.summary}{e.result && <span className="text-slate-600"> Result: {e.result}</span>} <span className="text-xs text-slate-400">({e.recordedBy})</span></li>
        ))}</ul>}
      </CardContent>
    </Card>
  )
}
