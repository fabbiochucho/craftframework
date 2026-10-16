import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Select } from './ui'
import { FLAG_LABEL, REMOVAL_GROUNDS, REMOVAL_GROUND_LABEL, type Flag, type FlagKey, type RatingSummary, type RemovalGround } from '../lib/validatorQuality'

// Validator system PR 7: feedback on validators, and the quality view for the CRAFT programme team.
// Every rule is enforced by /api/validator-quality; these components reflect what it allows.

async function api<T = any>(path: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method, cache: 'no-store',
    headers: init?.json !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error === 'mfa_required' ? 'Multi-factor sign-in required' : body?.error || `Request failed (${res.status})`)
  return body as T
}

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : '—')

export function Stars({ value, label }: { value: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} aria-hidden className={`h-4 w-4 ${n <= Math.round(value) ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} />)}
    </span>
  )
}

type Rating = { id: string; party: string; stars: number; comment: string; reply: string; replyAt: string | null; createdAt: string; country: string }
type Removed = Rating & { removalGround: string | null; removalReason: string | null }
export type Quality = { reviews: number; summary: RatingSummary; ratings: Rating[]; removed?: Removed[] }

const PARTY: Record<string, string> = { organisation: 'The organisation', funder: 'The funding partner' }

/** The validator's profile: how many validations they finished and what the parties said. */
export function ValidatorFeedback({ quality, isAdmin, onChanged }: { quality: Quality; isAdmin: boolean; onChanged: () => void }) {
  const [mine, setMine] = useState<Set<string>>(new Set())
  useEffect(() => { void api<{ ratings: Rating[] }>('/api/validator-quality/me').then((m) => setMine(new Set(m.ratings.map((r) => r.id))), () => setMine(new Set())) }, [quality])
  const { summary } = quality
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feedback</CardTitle>
        <p className="text-sm text-slate-500">
          {quality.reviews} finished {quality.reviews === 1 ? 'validation' : 'validations'}
          {summary.count > 0 && summary.average !== null && <> · <Stars value={summary.average} label={`Average ${summary.average} out of 5`} /> <span className="font-semibold text-slate-700">{summary.average}</span> from {summary.count} {summary.count === 1 ? 'rating' : 'ratings'}</>}
        </p>
        <p className="text-xs text-slate-500">Only the organisation (or the engaging funding partner) of a finished validation can rate its validator, once. Feedback shows the party and country, never names.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!quality.ratings.length && <p className="text-sm text-slate-500">No feedback yet.</p>}
        {quality.ratings.map((r) => (
          <div key={r.id} className="space-y-1 border-b border-slate-100 pb-3 text-sm last:border-0">
            <p className="flex flex-wrap items-center gap-2"><Stars value={r.stars} /> <span className="font-medium text-slate-700">{PARTY[r.party] ?? r.party}{r.country ? `, ${r.country}` : ''}</span> <span className="text-xs text-slate-500">{fmt(r.createdAt)}</span></p>
            {r.comment && <p className="whitespace-pre-line text-slate-700">{r.comment}</p>}
            {r.reply && <p className="whitespace-pre-line rounded bg-slate-50 p-2 text-slate-700"><span className="font-medium">Validator’s reply{r.replyAt ? ` (${fmt(r.replyAt)})` : ''}:</span> {r.reply}</p>}
            {mine.has(r.id) && <ReplyForm id={r.id} current={r.reply} onDone={onChanged} />}
            {isAdmin && <RemoveForm id={r.id} onDone={onChanged} />}
          </div>
        ))}
        {isAdmin && !!quality.removed?.length && (
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <h3 className="text-sm font-semibold text-slate-700">Removed feedback (admin only)</h3>
            {quality.removed.map((r) => (
              <div key={r.id} className="space-y-1 text-sm">
                <p className="flex flex-wrap items-center gap-2"><Stars value={r.stars} /> <Badge variant="outline" className="text-slate-600">{REMOVAL_GROUND_LABEL[r.removalGround as RemovalGround] ?? r.removalGround}</Badge></p>
                <p className="text-slate-600">{r.comment}</p>
                <p className="text-xs text-slate-500">Reason: {r.removalReason}</p>
                <RestoreForm id={r.id} onDone={onChanged} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function useAction(onDone: () => void) {
  const [error, setError] = useState('')
  const run = async (path: string, method: string, json: unknown) => {
    setError('')
    try { await api(path, { method, json }); onDone() } catch (e) { setError((e as Error).message) }
  }
  return { error, run }
}

function ReplyForm({ id, current, onDone }: { id: string; current: string; onDone: () => void }) {
  const [text, setText] = useState(current)
  const { error, run } = useAction(onDone)
  return (
    <form className="space-y-1" onSubmit={(e) => { e.preventDefault(); void run(`/api/validator-quality/ratings/${id}/reply`, 'PUT', { reply: text }) }}>
      <label className="block text-xs font-medium text-slate-600" htmlFor={`reply-${id}`}>Your public reply</label>
      <textarea id={`reply-${id}`} className="w-full rounded-lg border border-slate-300 p-2 text-sm" rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={!text.trim()}>{current ? 'Update reply' : 'Reply publicly'}</Button>
    </form>
  )
}

function RemoveForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [ground, setGround] = useState<RemovalGround>('abusive')
  const [reason, setReason] = useState('')
  const { error, run } = useAction(onDone)
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Remove feedback…</Button>
  return (
    <form className="space-y-2 rounded border border-rose-200 bg-rose-50/50 p-2" onSubmit={(e) => { e.preventDefault(); void run(`/api/validator-quality/ratings/${id}/remove`, 'POST', { ground, reason }) }}>
      <Select label="Ground" options={REMOVAL_GROUNDS.map((g) => ({ value: g, label: REMOVAL_GROUND_LABEL[g] }))} value={ground} onChange={(v) => setGround(v as RemovalGround)} />
      <label className="block text-xs font-medium text-slate-600" htmlFor={`rm-${id}`}>Reason (kept on record)</label>
      <textarea id={`rm-${id}`} className="w-full rounded-lg border border-slate-300 p-2 text-sm" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      <div className="flex gap-2"><Button type="submit" size="sm" disabled={reason.trim().length < 3}>Remove</Button><Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
    </form>
  )
}

function RestoreForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const { error, run } = useAction(onDone)
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void run(`/api/validator-quality/ratings/${id}/restore`, 'POST', { reason }) }}>
      <div><label className="block text-xs font-medium text-slate-600" htmlFor={`rs-${id}`}>Reason to restore</label><input id={`rs-${id}`} className="rounded-lg border border-slate-300 p-1.5 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <Button type="submit" size="sm" variant="outline" disabled={reason.trim().length < 3}>Restore</Button>
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    </form>
  )
}

type Mine = { engagementId: string; party: string; organization: string; validator: string; rating: null | { id: string; stars: number; comment: string; reply: string; status: string } }

/** Finished validations the signed-in person may rate (as the organisation or the engaging funding partner). */
export function RateYourValidator() {
  const [items, setItems] = useState<Mine[] | null>(null)
  const load = () => api<Mine[]>('/api/validator-quality/ratings/mine').then(setItems, () => setItems([]))
  useEffect(() => { void load() }, [])
  if (!items?.length) return null
  return (
    <Card>
      <CardHeader><CardTitle>Rate your validator</CardTitle><p className="text-sm text-slate-500">Once per validation. Your rating and comment appear on the validator’s profile with your party and country, not your name. The validator can reply.</p></CardHeader>
      <CardContent className="space-y-4">
        {items.map((m) => <RateRow key={`${m.engagementId}-${m.party}`} m={m} onDone={load} />)}
      </CardContent>
    </Card>
  )
}

function RateRow({ m, onDone }: { m: Mine; onDone: () => void }) {
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const { error, run } = useAction(onDone)
  const id = `${m.engagementId}-${m.party}`
  if (m.rating) {
    return (
      <div className="space-y-1 text-sm">
        <p className="font-medium text-slate-800">{m.validator} · {m.organization}</p>
        <p className="flex items-center gap-2"><Stars value={m.rating.stars} /> <span className="text-slate-500">{m.rating.status === 'removed' ? 'Removed by the CRAFT programme team' : 'Thank you — your rating is published'}</span></p>
        {m.rating.comment && <p className="text-slate-700">{m.rating.comment}</p>}
        {m.rating.reply && <p className="rounded bg-slate-50 p-2 text-slate-700"><span className="font-medium">Reply:</span> {m.rating.reply}</p>}
      </div>
    )
  }
  return (
    <form className="space-y-2 text-sm" onSubmit={(e) => { e.preventDefault(); void run('/api/validator-quality/ratings', 'POST', { engagementId: m.engagementId, party: m.party, stars, comment: comment.trim() || undefined }) }}>
      <p className="font-medium text-slate-800">{m.validator} · {m.organization}</p>
      <fieldset>
        <legend className="text-xs font-medium text-slate-600">Your rating</legend>
        <div className="mt-1 flex gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex items-center gap-1"><input type="radio" name={`stars-${id}`} value={n} checked={stars === n} onChange={() => setStars(n)} /> {n}</label>
          ))}
        </div>
      </fieldset>
      <label className="block text-xs font-medium text-slate-600" htmlFor={`c-${id}`}>Comment (optional, public — leave out personal details)</label>
      <textarea id={`c-${id}`} className="w-full rounded-lg border border-slate-300 p-2 text-sm" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      <Button type="submit" size="sm" disabled={!stars}>Submit rating</Button>
    </form>
  )
}

type FlagRow = { validationId: string; verificationId: string | null; organization: string; validatorName: string; firm: string | null; validatedRung: number; finalisedAt: string; flags: Flag[] }

/** Re-review flags: advice for the CRAFT programme team and for funders who follow a validation. Nothing here opens a re-review. */
export function ReReviewFlags() {
  const [rows, setRows] = useState<FlagRow[] | null>(null)
  useEffect(() => { void api<FlagRow[]>('/api/validator-quality/flags').then(setRows, () => setRows(null)) }, [])
  if (!rows?.length) return null
  return (
    <Card>
      <CardHeader><CardTitle>Validations to consider for re-review</CardTitle><p className="text-sm text-slate-500">Flags are advice only: nothing is opened or changed by them. A funding partner may require a re-review; complaints go to the Independent Review Panel.</p></CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.validationId} className="space-y-1 border-b border-slate-100 pb-3 text-sm last:border-0">
            <p className="font-medium text-slate-800">{r.verificationId ?? r.validationId} · {r.organization} <span className="font-normal text-slate-500">· rung {r.validatedRung} · {r.validatorName}{r.firm ? `, ${r.firm}` : ''} · finalised {fmt(r.finalisedAt)}</span></p>
            <ul className="list-disc pl-5 text-slate-700">{r.flags.map((f) => <li key={f.key}>{FLAG_LABEL[f.key as FlagKey] ?? f.label}{f.detail ? <span className="text-slate-500"> — {f.detail}</span> : null}</li>)}</ul>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

type StatRow = { validatorId: string | null; name: string; stats: { reviews: number; validated: number; withQualifications: number; notValidated: number; approvalRate: number | null; meanGap: number | null; meanRungDelta: number | null; withdrawn: number; concerns: number }; rating: RatingSummary }

/** Platform admin: statistics for every validator who has finished a validation. */
export function ValidatorStatistics() {
  const [rows, setRows] = useState<StatRow[] | null>(null)
  useEffect(() => { void api<StatRow[]>('/api/validator-quality/stats').then(setRows, () => setRows(null)) }, [])
  if (!rows?.length) return null
  const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`)
  return (
    <Card>
      <CardHeader><CardTitle>Validator statistics</CardTitle><p className="text-sm text-slate-500">From frozen reviews. Gap is the average difference between self-assessed and validator scores (0–5 scale).</p></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="text-xs uppercase text-slate-500"><th className="py-1 pr-3">Validator</th><th className="pr-3">Finished</th><th className="pr-3">Approved</th><th className="pr-3">Avg gap</th><th className="pr-3">Rung diff</th><th className="pr-3">Withdrawn</th><th className="pr-3">Concerns</th><th>Rating</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.validatorId ?? r.name} className="border-t border-slate-100">
                <td className="py-1 pr-3 font-medium text-slate-800">{r.name}</td><td className="pr-3">{r.stats.reviews}</td><td className="pr-3">{pct(r.stats.approvalRate)}</td>
                <td className="pr-3">{r.stats.meanGap ?? '—'}</td><td className="pr-3">{r.stats.meanRungDelta ?? '—'}</td><td className="pr-3">{r.stats.withdrawn}</td><td className="pr-3">{r.stats.concerns}</td>
                <td>{r.rating.average !== null ? `${r.rating.average} (${r.rating.count})` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
