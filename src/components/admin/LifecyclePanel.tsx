import { useCallback, useEffect, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Stat, Table, Tbody, Td, Th, Thead } from '../ui'
import { adminLifecycle } from '../../lib/lifecycleApi'
import { CAP_DAYS, CHECKIN_GAP_DAYS, INACTIVE_DAYS, type LifecycleKind } from '../../lib/lifecycle'

type Status = {
  paused: boolean; configured: boolean; missing: string[]
  perKind: Array<{ kind: LifecycleKind; label: string; sent: number; failed: number; notConfigured: number; skipped: number; unsubscribed: number }>
  optedOut: { checkins: number; celebrations: number }
  survey: { emailsWithSurvey: number; responses: number; responseRatePct: number | null }
  engagement: { emailsInWindow: number; clickedPct: number | null; signedInWithin7DaysPct: number | null; recipients: number; recipientsSignedInWithin7Days: number }
}
type Schedule = { kinds: Array<{ kind: LifecycleKind; label: string; count: number; rows: Array<{ email: string; name: string; orgName: string; occurrence: number; dueAt: string; plannedSend: string; note?: string }> }> }
type History = { rows: Array<{ id: string; email: string; name: string; orgName: string; kind: string; occurrence: number; variant: string; outcome: string; skipReason: string | null; attempts: number; subject: string; sentAt: string | null; clickedAt: string | null; unsubscribedAt: string | null }> }
type Variants = { variants: Array<{ id: string; label: string }> }
type Preview = { subject: string; html: string; text: string }
type Survey = {
  nps: { responses: number; promoters: number; passives: number; detractors: number; score: number | null }
  trend: Array<{ month: string; responses: number; score: number | null }>
  easeAverage: number | null
  usedMost: Array<{ label: string; count: number }>
  improvements: Array<{ id: string; at: string; text: string; name: string; email: string; orgName: string }>
  callRequests: Array<{ id: string; at: string; times: string; handledAt: string | null; handledBy: string | null; name: string; email: string; orgName: string }>
}

const date = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 10) : '–')
const pct = (n: number | null) => (n === null ? '–' : `${n}%`)
const OUTCOME: Record<string, string> = { accepted: 'Sent', failed: 'Failed', not_configured: 'Not configured', pending: 'Sending', skipped: 'Not sent' }
const SKIP: Record<string, string> = { assessment_started: 'assessment already started', expired: 'too late to send', superseded: 'a later milestone replaced it', org_celebrated: 'colleague already celebrated' }

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>{title}</CardTitle>{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// The Super Admin's lifecycle email controls: the pause-all switch, what is due, what was sent, every template with
// sample data, and the survey results. All of it comes from /api/admin-lifecycle (Super Admin + MFA only).
export function LifecyclePanel() {
  const [status, setStatus] = useState<Status | null>(null)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [history, setHistory] = useState<History | null>(null)
  const [variants, setVariants] = useState<Variants['variants']>([])
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [who, setWho] = useState('')
  const [pick, setPick] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [plain, setPlain] = useState(false)
  const [busy, setBusy] = useState(false)

  const fail = (e: Error) => setError(e.message || 'Could not load lifecycle emails.')
  const load = useCallback(() => {
    adminLifecycle.status<Status>().then((s) => { setStatus(s); setError(null) }).catch(fail)
    adminLifecycle.schedule<Schedule>().then(setSchedule).catch(fail)
    adminLifecycle.history<History>().then(setHistory).catch(fail)
    adminLifecycle.survey<Survey>().then(setSurvey).catch(fail)
    adminLifecycle.variants<Variants>().then((v) => { setVariants(v.variants); setPick((p) => p || v.variants[0]?.id || '') }).catch(fail)
  }, [])
  useEffect(load, [load])
  useEffect(() => { if (pick) adminLifecycle.preview<Preview>(pick).then(setPreview).catch(fail) }, [pick])

  async function togglePause() {
    if (!status) return
    setBusy(true)
    try { const r = await adminLifecycle.pause(!status.paused); setStatus({ ...status, paused: r.paused }) } catch (e) { fail(e as Error) } finally { setBusy(false) }
  }
  async function mark(id: string, handled: boolean) {
    try { await adminLifecycle.handled(id, handled); setSurvey(await adminLifecycle.survey<Survey>()) } catch (e) { fail(e as Error) }
  }
  async function search(e: React.FormEvent) {
    e.preventDefault()
    try { setHistory(await adminLifecycle.history<History>(who.trim().toLowerCase() || undefined)) } catch (err) { fail(err as Error) }
  }

  return (
    <div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {!status && !error && <p role="status" className="mt-4 text-sm text-slate-500">Loading…</p>}

      {status && (
        <Section title="Status" hint={`The scheduler runs daily at 09:00 UTC (10:00 Lagos) and sends only on Tuesday, Wednesday and Thursday. No one gets more than one lifecycle email in ${CAP_DAYS} days; check-ins go to people away ${INACTIVE_DAYS}+ days, at most once every ${CHECKIN_GAP_DAYS} days.`}>
          <div className="flex flex-wrap items-center gap-4">
            <Badge className={status.paused ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}>{status.paused ? 'Paused: nothing is being sent' : 'Running'}</Badge>
            <Button variant={status.paused ? 'primary' : 'outline'} onClick={togglePause} disabled={busy}>
              {status.paused ? <><Play className="h-4 w-4" /> Resume all lifecycle emails</> : <><Pause className="h-4 w-4" /> Pause all lifecycle emails</>}
            </Button>
          </div>
          {!status.configured && <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Email is not fully configured on this deployment, so nothing is sent. Missing: {status.missing.join(', ')}.</p>}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Survey response rate" value={pct(status.survey.responseRatePct)} hint={`${status.survey.responses} of ${status.survey.emailsWithSurvey} emails with a survey link`} />
            <Stat label="Clicked a button (7+ days old)" value={pct(status.engagement.clickedPct)} hint={`of ${status.engagement.emailsInWindow} emails`} />
            <Stat label="Signed in within 7 days" value={pct(status.engagement.signedInWithin7DaysPct)} hint={`${status.engagement.recipientsSignedInWithin7Days} of ${status.engagement.recipients} recipients`} />
            <Stat label="Opted out" value={String(status.optedOut.checkins + status.optedOut.celebrations)} hint={`${status.optedOut.checkins} check-ins, ${status.optedOut.celebrations} celebrations`} />
          </div>
          <Table className="mt-4">
            <Thead><tr><Th>Kind</Th><Th className="text-right">Sent</Th><Th className="text-right">Failed</Th><Th className="text-right">Unsubscribed</Th><Th className="text-right">Not sent (rules)</Th></tr></Thead>
            <Tbody>{status.perKind.map((k) => (
              <tr key={k.kind}><Td>{k.label}</Td><Td className="text-right tabular-nums">{k.sent}</Td><Td className="text-right tabular-nums">{k.failed}</Td>
                <Td className="text-right tabular-nums">{k.unsubscribed}</Td><Td className="text-right tabular-nums">{k.skipped}</Td></tr>
            ))}</Tbody>
          </Table>
        </Section>
      )}

      {schedule && (
        <Section title="Due in the next 30 days" hint="Planned send is the next Tuesday–Thursday after the due date (and after the 14-day gap since that person's last email). Check-ins appear only if the person is still away.">
          {schedule.kinds.map((k) => (
            <details key={k.kind} className="mb-2 rounded-lg border border-slate-200 p-3" open={k.count > 0 && k.count <= 5}>
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">{k.label} <span className="font-normal text-slate-500">({k.count})</span></summary>
              {k.rows.length === 0 ? <p className="mt-2 text-sm text-slate-500">Nothing due.</p> : (
                <div className="mt-2 overflow-x-auto"><Table>
                  <Thead><tr><Th>Person</Th><Th>Organisation</Th><Th>Due</Th><Th>Planned send</Th><Th>Note</Th></tr></Thead>
                  <Tbody>{k.rows.map((r) => (
                    <tr key={`${r.email}-${r.occurrence}`}><Td>{r.name || r.email}<span className="block text-xs text-slate-500">{r.email}</span></Td><Td>{r.orgName || '–'}</Td>
                      <Td>{date(r.dueAt)}{k.kind === 'milestone' ? ` (${r.occurrence} months)` : ''}</Td><Td>{date(r.plannedSend)}</Td><Td className="text-xs text-slate-500">{r.note ?? ''}</Td></tr>
                  ))}</Tbody>
                </Table></div>
              )}
            </details>
          ))}
        </Section>
      )}

      <Section title="History" hint="What was sent when, and what happened. Search one person's address, or see the latest 100.">
        <form onSubmit={search} className="mb-3 flex flex-wrap items-end gap-2">
          <div><label htmlFor="lc-who" className="block text-xs text-slate-600">Email address</label>
            <input id="lc-who" type="email" value={who} onChange={(e) => setWho(e.target.value)} placeholder="person@example.org" className="w-72 max-w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div>
          <Button type="submit" variant="outline">Search</Button>
        </form>
        {history && history.rows.length === 0 ? <p className="text-sm text-slate-500">Nothing sent yet.</p> : history && (
          <div className="overflow-x-auto"><Table>
            <Thead><tr><Th>Sent</Th><Th>Person</Th><Th>Email</Th><Th>Outcome</Th><Th>Clicked</Th></tr></Thead>
            <Tbody>{history.rows.map((r) => (
              <tr key={r.id}><Td className="whitespace-nowrap">{date(r.sentAt)}</Td><Td>{r.name || r.email}<span className="block text-xs text-slate-500">{r.email}{r.orgName ? ` · ${r.orgName}` : ''}</span></Td>
                <Td>{r.kind.replace('_', ' ')}{r.kind === 'milestone' ? ` ${r.occurrence}m` : ''} <span className="text-xs text-slate-500">({r.variant})</span></Td>
                <Td>{OUTCOME[r.outcome] ?? r.outcome}{r.skipReason ? `: ${SKIP[r.skipReason] ?? r.skipReason}` : ''}{r.attempts > 1 ? `, attempt ${r.attempts}` : ''}{r.unsubscribedAt ? ', unsubscribed' : ''}</Td>
                <Td>{r.clickedAt ? date(r.clickedAt) : '–'}</Td></tr>
            ))}</Tbody>
          </Table></div>
        )}
      </Section>

      <Section title="Preview every email" hint="Rendered with made-up people and numbers. The links in a preview are placeholders.">
        <div className="flex flex-wrap items-end gap-3">
          <div><label htmlFor="lc-variant" className="block text-xs text-slate-600">Template and variant</label>
            <select id="lc-variant" value={pick} onChange={(e) => setPick(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select></div>
          <Button variant="outline" onClick={() => setPlain((p) => !p)}>{plain ? 'Show HTML' : 'Show plain text'}</Button>
        </div>
        {preview && (
          <div className="mt-3">
            <p className="text-sm"><span className="text-slate-500">Subject:</span> <b data-testid="lifecycle-preview-subject">{preview.subject}</b></p>
            {plain ? <pre className="mt-2 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">{preview.text}</pre>
              : <iframe title={`Email preview: ${preview.subject}`} sandbox="" srcDoc={preview.html} className="mt-2 h-[36rem] w-full rounded-lg border border-slate-200 bg-white" />}
          </div>
        )}
      </Section>

      {survey && (
        <Section title="Survey results" hint="From the one-month and anniversary survey. Promoters score 9–10, passives 7–8, detractors 0–6.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Net Promoter Score" value={survey.nps.score === null ? '–' : String(survey.nps.score)} hint={`${survey.nps.responses} responses`} />
            <Stat label="Promoters / passives / detractors" value={`${survey.nps.promoters} / ${survey.nps.passives} / ${survey.nps.detractors}`} />
            <Stat label="Ease of use (1–5)" value={survey.easeAverage === null ? '–' : String(survey.easeAverage)} />
            <Stat label="Call requests" value={String(survey.callRequests.length)} hint={`${survey.callRequests.filter((c) => !c.handledAt).length} to handle`} />
          </div>
          <h3 className="mt-5 text-sm font-semibold text-slate-800">NPS by month</h3>
          {survey.trend.length === 0 ? <p className="text-sm text-slate-500">No responses yet.</p> : (
            <Table className="mt-1"><Thead><tr><Th>Month</Th><Th className="text-right">Responses</Th><Th className="text-right">NPS</Th></tr></Thead>
              <Tbody>{survey.trend.map((t) => <tr key={t.month}><Td>{t.month}</Td><Td className="text-right tabular-nums">{t.responses}</Td><Td className="text-right tabular-nums">{t.score ?? '–'}</Td></tr>)}</Tbody></Table>
          )}
          <h3 className="mt-5 text-sm font-semibold text-slate-800">What people use most</h3>
          <Table className="mt-1"><Thead><tr><Th>Area</Th><Th className="text-right">People</Th></tr></Thead>
            <Tbody>{survey.usedMost.map((u) => <tr key={u.label}><Td>{u.label}</Td><Td className="text-right tabular-nums">{u.count}</Td></tr>)}</Tbody></Table>
          <h3 className="mt-5 text-sm font-semibold text-slate-800">Latest suggestions</h3>
          {survey.improvements.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
            <ul className="mt-1 space-y-2">{survey.improvements.map((i) => (
              <li key={i.id} className="rounded-lg border border-slate-200 p-3 text-sm"><p className="whitespace-pre-wrap text-slate-800">{i.text}</p>
                <p className="mt-1 text-xs text-slate-500">{i.name} · {i.orgName || i.email} · {date(i.at)}</p></li>
            ))}</ul>
          )}
          <h3 className="mt-5 text-sm font-semibold text-slate-800">Call requests</h3>
          {survey.callRequests.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
            <div className="overflow-x-auto"><Table className="mt-1">
              <Thead><tr><Th>Person</Th><Th>Organisation</Th><Th>Preferred times</Th><Th>Asked</Th><Th>Status</Th></tr></Thead>
              <Tbody>{survey.callRequests.map((c) => (
                <tr key={c.id}><Td>{c.name}<span className="block text-xs text-slate-500">{c.email}</span></Td><Td>{c.orgName || '–'}</Td><Td>{c.times || '–'}</Td><Td>{date(c.at)}</Td>
                  <Td>{c.handledAt ? <span className="text-emerald-700">Handled {date(c.handledAt)}</span> : null}{' '}
                    <Button variant="outline" size="sm" onClick={() => mark(c.id, !c.handledAt)} aria-label={`${c.handledAt ? 'Reopen' : 'Mark handled'}: ${c.name}`}>{c.handledAt ? 'Reopen' : 'Mark handled'}</Button></Td></tr>
              ))}</Tbody>
            </Table></div>
          )}
        </Section>
      )}
    </div>
  )
}
