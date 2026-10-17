import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, Mail, Send } from 'lucide-react'
import { useAuthCtx } from '../lib/context'
import { isSuperAdminEmail } from '../lib/data'
import * as api from '../lib/api'
import { RANGES, sortStalled, type FunnelRow, type RangeKey, type StalledPerson, type StalledSortKey } from '../lib/adminAnalytics'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Stat, Table, Tabs, Tbody, Td, Th, Thead } from '../components/ui'

type Labelled = { label: string; count: number }
type Stalled = StalledPerson & { optedOut: boolean; nextNudgeAllowedAt: string | null }
type Payload = {
  generatedAt: string
  onboarding: {
    signedUp: number; started: number; completed: number; medianHoursToComplete: number | null
    reachedStep: Array<{ step: number; name: string; count: number }>; stalled: Stalled[]
  }
  orgFunnel: FunnelRow[]
  validators: {
    funnel: FunnelRow[]; exam: { attempts: number; passed: number; passRatePct: number | null }
    hardestQuestions: Array<{ id: string; topic: string; prompt: string; asked: number; pctCorrect: number }>
  }
  activity: {
    dau: number; wau: number; mau: number; returning: number; oneOff: number; activeInRange: number; historyNote: string
    byRole: Labelled[]; byCountry: Labelled[]; series: Array<{ day: string; active: number }>
  }
  directory: {
    totalSearches: number; noResultSearches: number; noResultQueries: Array<{ type: string; query: string; count: number }>
    mostViewed: Array<{ kind: string; name: string; views: number }>; proposals: Array<{ status: string; count: number }>
  }
  support: {
    issuesByCategory: Labelled[]; escalationsByCategory: Labelled[]; escalationsByReason: Labelled[]; openIssues: number
    unresolvedEscalations: Array<{ category: string; reason: string; status: string; createdAt: string; ageDays: number }>
  }
  operations: {
    emailsByType: Array<{ kind: string; sent: number; failed: number; notConfigured: number }>
    panelOpenCases: number; panelDecidedCases: number; panelMedianDecisionDays: number | null
  }
}
type Preview = {
  email: string; name?: string; orgName?: string; step?: number; stepName?: string; eligible: boolean
  reasonText: string | null; nextAllowedAt?: string | null; subject?: string; html?: string; text?: string
}
type PreviewResponse = { configured: boolean; missing: string[]; replyTo: string; previews: Preview[] }
type SendResult = { email: string; outcome: string; reasonText?: string }

const TABS = [
  { id: 'onboarding', label: 'Onboarding' }, { id: 'orgs', label: 'Organisations' }, { id: 'validators', label: 'Validators' },
  { id: 'activity', label: 'Activity' }, { id: 'directory', label: 'Directory' }, { id: 'support', label: 'Support' }, { id: 'ops', label: 'Operations' },
]
const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 10) : '–')
const hours = (h: number | null) => (h === null ? '–' : h < 48 ? `${Math.round(h * 10) / 10} h` : `${Math.round(h / 24 * 10) / 10} days`)
const OUTCOME_TEXT: Record<string, string> = {
  accepted: 'Sent', failed: 'Delivery failed — can be retried', not_configured: 'Email is not configured on this deployment', refused: 'Not sent',
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>{title}</CardTitle>{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// A funnel as a bar chart plus the same numbers as a table (the table is the accessible version of the chart).
function Funnel({ rows, name, of }: { rows: FunnelRow[]; name: string; of: string }) {
  const height = Math.max(180, rows.length * 38)
  return (
    <div>
      <figure aria-label={name} className="m-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [String(v), 'People or organisations']} />
            <Bar dataKey="count" fill="#059669" radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </figure>
      <Table className="mt-3">
        <Thead><tr><Th>Step</Th><Th className="text-right">Count</Th><Th className="text-right">Drop-off from previous</Th><Th className="text-right">% of {of}</Th></tr></Thead>
        <Tbody>
          {rows.map((r) => (
            <tr key={r.key}><Td>{r.label}</Td><Td className="text-right tabular-nums">{r.count}</Td>
              <Td className="text-right tabular-nums">{r.dropOffPct ? `−${r.dropOffPct}%` : '–'}</Td><Td className="text-right tabular-nums">{r.ofFirstPct}%</Td></tr>
          ))}
        </Tbody>
      </Table>
    </div>
  )
}

function Bars({ data, name }: { data: Labelled[]; name: string }) {
  if (!data.length) return <p className="text-sm text-slate-500">Nothing in this period.</p>
  return (
    <div>
      <figure aria-label={name} className="m-0" style={{ height: Math.max(120, data.length * 32) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11 }} />
            <Tooltip /><Bar dataKey="count" fill="#4f46e5" radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </figure>
      <ul className="sr-only">{data.map((d) => <li key={d.label}>{d.label}: {d.count}</li>)}</ul>
    </div>
  )
}

function StalledTable({ rows, onEmail }: { rows: Stalled[]; onEmail: (emails: string[]) => void }) {
  const [sort, setSort] = useState<{ key: StalledSortKey; dir: 'asc' | 'desc' }>({ key: 'daysStalled', dir: 'desc' })
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const sorted = useMemo(() => sortStalled(rows, sort.key, sort.dir) as Stalled[], [rows, sort])
  const selectable = sorted.filter((r) => !r.optedOut)
  const toggle = (email: string) => setPicked((p) => { const n = new Set(p); if (n.has(email)) n.delete(email); else n.add(email); return n })
  const header = (key: StalledSortKey, label: string) => (
    <Th className="whitespace-nowrap" >
      <button type="button" className="inline-flex items-center gap-1 uppercase" onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}
        aria-label={`Sort by ${label}${sort.key === key ? (sort.dir === 'asc' ? ', ascending' : ', descending') : ''}`}>
        {label}<span aria-hidden="true">{sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </Th>
  )
  const chosen = [...picked].filter((e) => selectable.some((r) => r.email === e))
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Button disabled={!chosen.length} onClick={() => onEmail(chosen)}><Mail className="h-4 w-4" /> Email selected ({chosen.length})</Button>
        <p className="text-xs text-slate-500">Each person can be emailed at most once every 7 days. People who asked to stop reminders cannot be selected.</p>
      </div>
      {rows.length === 0 ? <p className="text-sm text-slate-500">Nobody has started onboarding without finishing in this period.</p> : (
        <Table>
          <Thead>
            <tr>
              <Th><input type="checkbox" aria-label="Select all people who can be emailed" checked={selectable.length > 0 && chosen.length === selectable.length}
                onChange={(e) => setPicked(e.target.checked ? new Set(selectable.map((r) => r.email)) : new Set())} /></Th>
              {header('name', 'Name')}<Th>Email</Th>{header('orgName', 'Organisation')}{header('step', 'Step reached')}
              {header('startedAt', 'Started')}{header('lastActivityAt', 'Last activity')}{header('daysStalled', 'Days stalled')}{header('nudgesSent', 'Nudges sent')}
            </tr>
          </Thead>
          <Tbody>
            {sorted.map((r) => (
              <tr key={r.email}>
                <Td><input type="checkbox" disabled={r.optedOut} checked={picked.has(r.email)} onChange={() => toggle(r.email)} aria-label={`Select ${r.name || r.email}`} /></Td>
                <Td>{r.name || '–'}</Td><Td className="break-all">{r.email}</Td><Td>{r.orgName || '–'}</Td>
                <Td className="whitespace-nowrap">{r.step} of 3: {r.stepName}</Td><Td>{fmtDate(r.startedAt)}</Td><Td>{fmtDate(r.lastActivityAt)}</Td>
                <Td className="tabular-nums">{r.daysStalled}</Td>
                <Td className="tabular-nums">{r.nudgesSent}{r.optedOut && <> <Badge className="bg-slate-100 text-slate-600">opted out</Badge></>}
                  {!r.optedOut && r.nextNudgeAllowedAt && new Date(r.nextNudgeAllowedAt) > new Date() && <div className="text-xs text-slate-500">next on {fmtDate(r.nextNudgeAllowedAt)}</div>}</Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}

function NudgePanel({ emails, onClose, onSent }: { emails: string[]; onClose: () => void; onSent: () => void }) {
  const [note, setNote] = useState('')
  const [data, setData] = useState<PreviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<SendResult[] | null>(null)

  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      api.nudgeRequest<PreviewResponse>('preview', emails, note)
        .then((d) => { if (live) { setData(d); setError(null) } })
        .catch((e: Error) => { if (live) setError(e.message) })
    }, 300)
    return () => { live = false; clearTimeout(t) }
  }, [emails, note])

  const eligible = data?.previews.filter((p) => p.eligible) ?? []
  async function send() {
    setSending(true)
    try {
      const r = await api.nudgeRequest<{ results: SendResult[] }>('send', eligible.map((p) => p.email), note)
      setResults(r.results)
      onSent()
    } catch (e) {
      setError(e instanceof api.AdminAnalyticsError && e.code === 'not_configured' ? 'Sending is not set up on this deployment yet (see the missing settings above).' : (e as Error).message)
    } finally { setSending(false) }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Email selected people" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className="my-6 w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-emerald-900">Email {emails.length} {emails.length === 1 ? 'person' : 'people'}</h2>
            <p className="text-sm text-slate-600">Subject: <strong>Finish setting up your CRAFT workspace</strong>. Replies come to {data?.replyTo ?? 'you'}.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>

        {data && !data.configured && (
          <p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Sending is switched off until these Netlify environment variables are set: <code>{data.missing.join(', ')}</code>. You can still preview.
          </p>
        )}
        {error && <p role="alert" className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

        <label htmlFor="nudge-note" className="mt-4 block text-sm font-medium text-slate-700">Personal note (optional, shown to everyone selected)</label>
        <textarea id="nudge-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" placeholder="e.g. Happy to jump on a call if the donor step is unclear." />
        <p className="text-right text-xs text-slate-400">{note.length}/600</p>

        {!data && !error && <p className="mt-3 text-sm text-slate-500" role="status">Loading preview…</p>}
        <ul className="mt-2 space-y-2">
          {data?.previews.map((p) => (
            <li key={p.email} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-all text-sm font-semibold text-slate-900">{p.name || p.email} <span className="font-normal text-slate-500">{p.name ? `· ${p.email}` : ''}</span></p>
                  {p.stepName && <p className="text-xs text-slate-500">{p.orgName || 'No organisation name'} · stopped at step {p.step} of 3: {p.stepName}</p>}
                </div>
                {p.eligible ? <Badge className="bg-emerald-100 text-emerald-800">Will be sent</Badge>
                  : <Badge className="bg-rose-100 text-rose-800">Won’t be sent: {p.reasonText}{p.nextAllowedAt ? ` (again on ${fmtDate(p.nextAllowedAt)})` : ''}</Badge>}
              </div>
              {p.html && (
                <>
                  <button type="button" className="mt-2 text-xs font-medium text-emerald-700 underline" aria-expanded={open === p.email} onClick={() => setOpen(open === p.email ? null : p.email)}>
                    {open === p.email ? 'Hide preview' : 'Show preview'}
                  </button>
                  {open === p.email && (
                    <div className="mt-2">
                      <iframe title={`Email preview for ${p.email}`} sandbox="" srcDoc={p.html} className="h-[560px] w-full rounded-lg border border-slate-200" />
                      <details className="mt-2 text-xs"><summary className="cursor-pointer text-slate-600">Plain-text version</summary><pre className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2">{p.text}</pre></details>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>

        {results && (
          <div role="status" className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold">Result</p>
            <ul>{results.map((r) => <li key={r.email}>{r.email}: {OUTCOME_TEXT[r.outcome] ?? r.outcome}{r.reasonText ? ` (${r.reasonText})` : ''}</li>)}</ul>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{results ? 'Done' : 'Cancel'}</Button>
          {!results && <Button disabled={sending || !data?.configured || !eligible.length} onClick={send}><Send className="h-4 w-4" /> {sending ? 'Sending…' : `Send to ${eligible.length}`}</Button>}
        </div>
      </div>
    </div>
  )
}

export function AdminAnalyticsPage() {
  const { currentUser } = useAuthCtx()
  const allowed = !!currentUser && isSuperAdminEmail(currentUser.email)
  const [range, setRange] = useState<RangeKey>('30')
  const [tab, setTab] = useState('onboarding')
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nudging, setNudging] = useState<string[] | null>(null)

  const load = useCallback(() => {
    api.fetchAdminAnalytics<Payload>(range).then((d) => { setData(d); setError(null) }).catch((e: Error) => {
      setError(e instanceof api.AdminAnalyticsError && e.status === 403 ? 'This page is only for the CRAFT Super Admin.'
        : e instanceof api.AdminAnalyticsError && e.code === 'mfa_required' ? 'Confirm your multi-factor code first (Security), then reload.' : 'Could not load analytics. Please try again.')
    })
  }, [range])
  useEffect(() => { if (allowed) load() }, [allowed, load])

  if (!allowed) {
    return <div className="p-6"><p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">This page is only for the CRAFT Super Admin.</p></div>
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Super Admin</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-emerald-900">Platform analytics</h1>
          <p className="text-sm text-slate-500">From CRAFT’s own database. Aggregates, plus a people list for onboarding follow-up that only you can see.</p>
        </div>
        <div>
          <label htmlFor="range" className="mr-2 text-sm text-slate-600">Period</label>
          <select id="range" value={range} onChange={(e) => setRange(e.target.value as RangeKey)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {!data && !error && <p role="status" className="mt-4 text-sm text-slate-500">Loading…</p>}

      {data && tab === 'onboarding' && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Signed up" value={data.onboarding.signedUp} />
            <Stat label="Started onboarding" value={data.onboarding.started} />
            <Stat label="Finished" value={data.onboarding.completed} hint={data.onboarding.started ? `${Math.round(data.onboarding.completed / data.onboarding.started * 100)}% of those who started` : undefined} />
            <Stat label="Median time to finish" value={hours(data.onboarding.medianHoursToComplete)} />
          </div>
          <Section title="Where people got to" hint="Highest step reached, of everyone who started in this period.">
            <Funnel name="Onboarding steps reached" of="started" rows={[{ key: 'started', label: 'Started', count: data.onboarding.started, dropOffPct: 0, ofFirstPct: 100 },
              ...data.onboarding.reachedStep.map((s, i, a) => {
                const prev = i === 0 ? data.onboarding.started : a[i - 1].count
                return { key: `s${s.step}`, label: `Reached step ${s.step}: ${s.name}`, count: s.count, dropOffPct: prev ? Math.max(0, Math.round((prev - s.count) / prev * 1000) / 10) : 0, ofFirstPct: data.onboarding.started ? Math.round(s.count / data.onboarding.started * 1000) / 10 : 0 }
              })]} />
          </Section>
          <Section title="Started but did not finish" hint="Select people to send a ‘finish setting up’ email.">
            <StalledTable rows={data.onboarding.stalled} onEmail={setNudging} />
          </Section>
        </>
      )}

      {data && tab === 'orgs' && (
        <Section title="Organisation funnel" hint="Organisations whose first person signed up in this period. Each step counts only organisations that also completed the one before.">
          <Funnel name="Organisation funnel" of="signed up" rows={data.orgFunnel} />
        </Section>
      )}

      {data && tab === 'validators' && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Exam attempts" value={data.validators.exam.attempts} />
            <Stat label="Exam passed" value={data.validators.exam.passed} />
            <Stat label="Exam pass rate" value={data.validators.exam.passRatePct === null ? '–' : `${data.validators.exam.passRatePct}%`} />
          </div>
          <Section title="Validator funnel" hint="Validator profiles created in this period. The exam, cases and capstone can be done in any order, so each is a share of profiles, not of the step above.">
            <Funnel name="Validator funnel" of="profiles" rows={data.validators.funnel} />
          </Section>
          <Section title="Hardest exam questions" hint="Lowest share answered correctly across submitted attempts (questions asked at least 3 times).">
            {data.validators.hardestQuestions.length === 0 ? <p className="text-sm text-slate-500">Not enough exam attempts yet.</p> : (
              <Table><Thead><tr><Th>Question</Th><Th>Topic</Th><Th className="text-right">Asked</Th><Th className="text-right">% correct</Th></tr></Thead>
                <Tbody>{data.validators.hardestQuestions.map((q) => <tr key={q.id}><Td>{q.prompt}</Td><Td>{q.topic}</Td><Td className="text-right tabular-nums">{q.asked}</Td><Td className="text-right tabular-nums">{q.pctCorrect}%</Td></tr>)}</Tbody></Table>
            )}
          </Section>
        </>
      )}

      {data && tab === 'activity' && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Active today" value={data.activity.dau} /><Stat label="Active, 7 days" value={data.activity.wau} /><Stat label="Active, 30 days" value={data.activity.mau} />
            <Stat label="Returning" value={data.activity.returning} hint="seen on 2+ days in this period" /><Stat label="One-off" value={data.activity.oneOff} hint="seen on 1 day" />
          </div>
          <Section title="Daily active people" hint={data.activity.historyNote}>
            <figure aria-label="Daily active people" className="m-0 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.activity.series}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11 }} minTickGap={16} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} /><Tooltip /><Bar dataKey="active" fill="#059669" isAnimationActive={false} /></BarChart>
              </ResponsiveContainer>
            </figure>
          </Section>
          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Active people by role"><Bars name="Active people by role" data={data.activity.byRole} /></Section>
            <Section title="Active people by country"><Bars name="Active people by country" data={data.activity.byCountry} /></Section>
          </div>
        </>
      )}

      {data && tab === 'directory' && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Searches" value={data.directory.totalSearches} /><Stat label="With no results" value={data.directory.noResultSearches} accent="amber" />
            {data.directory.proposals.filter((p) => p.status === 'approved' || p.status === 'rejected').map((p) => <Stat key={p.status} label={`Listings ${p.status}`} value={p.count} />)}
          </div>
          <Section title="Searches with no results" hint="What people looked for and did not find. Aggregated; no one is identified.">
            {data.directory.noResultQueries.length === 0 ? <p className="text-sm text-slate-500">None in this period.</p> : (
              <Table><Thead><tr><Th>Search</Th><Th>Looking for</Th><Th className="text-right">Times</Th></tr></Thead>
                <Tbody>{data.directory.noResultQueries.map((q) => <tr key={q.type + q.query}><Td>“{q.query}”</Td><Td>{q.type}</Td><Td className="text-right tabular-nums">{q.count}</Td></tr>)}</Tbody></Table>
            )}
          </Section>
          <Section title="Most-viewed profiles">
            {data.directory.mostViewed.length === 0 ? <p className="text-sm text-slate-500">No profile views in this period.</p> : (
              <Table><Thead><tr><Th>Profile</Th><Th>Kind</Th><Th className="text-right">Views</Th></tr></Thead>
                <Tbody>{data.directory.mostViewed.map((v) => <tr key={v.kind + v.name}><Td>{v.name}</Td><Td>{v.kind}</Td><Td className="text-right tabular-nums">{v.views}</Td></tr>)}</Tbody></Table>
            )}
          </Section>
          <Section title="Listing proposals" hint="Proposals made in this period, by decision.">
            <Table><Thead><tr><Th>Status</Th><Th className="text-right">Count</Th></tr></Thead><Tbody>{data.directory.proposals.map((p) => <tr key={p.status}><Td className="capitalize">{p.status}</Td><Td className="text-right tabular-nums">{p.count}</Td></tr>)}</Tbody></Table>
          </Section>
        </>
      )}

      {data && tab === 'support' && (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Section title="Support issues by category" hint={`${data.support.openIssues} open in total.`}><Bars name="Support issues by category" data={data.support.issuesByCategory} /></Section>
            <Section title="Bot escalations by category"><Bars name="Escalations by category" data={data.support.escalationsByCategory} /></Section>
          </div>
          <Section title="Why the bot escalated"><Bars name="Escalations by reason" data={data.support.escalationsByReason} /></Section>
          <Section title="Unresolved escalations" hint="Not yet delivered to the support inbox. Message text is not shown here.">
            {data.support.unresolvedEscalations.length === 0 ? <p className="text-sm text-slate-500">None. Every escalation has been delivered.</p> : (
              <Table><Thead><tr><Th>Category</Th><Th>Reason</Th><Th>Status</Th><Th className="text-right">Age (days)</Th></tr></Thead>
                <Tbody>{data.support.unresolvedEscalations.map((e, i) => <tr key={i}><Td>{e.category}</Td><Td>{e.reason}</Td><Td>{e.status}</Td><Td className="text-right tabular-nums">{e.ageDays}</Td></tr>)}</Tbody></Table>
            )}
          </Section>
        </>
      )}

      {data && tab === 'ops' && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Review Panel cases open" value={data.operations.panelOpenCases} /><Stat label="Decided in period" value={data.operations.panelDecidedCases} />
            <Stat label="Median time to decision" value={data.operations.panelMedianDecisionDays === null ? '–' : `${Math.round(data.operations.panelMedianDecisionDays * 10) / 10} days`} />
          </div>
          <Section title="Emails by type" hint="Outcome reported by the email provider for each send.">
            {data.operations.emailsByType.length === 0 ? <p className="text-sm text-slate-500">No emails recorded in this period.</p> : (
              <Table><Thead><tr><Th>Type</Th><Th className="text-right">Sent</Th><Th className="text-right">Failed</Th><Th className="text-right">Not configured</Th></tr></Thead>
                <Tbody>{data.operations.emailsByType.map((m) => <tr key={m.kind}><Td>{m.kind.replace(/_/g, ' ')}</Td><Td className="text-right tabular-nums">{m.sent}</Td><Td className="text-right tabular-nums">{m.failed}</Td><Td className="text-right tabular-nums">{m.notConfigured}</Td></tr>)}</Tbody></Table>
            )}
          </Section>
        </>
      )}

      {nudging && <NudgePanel emails={nudging} onClose={() => setNudging(null)} onSent={load} />}
    </div>
  )
}
