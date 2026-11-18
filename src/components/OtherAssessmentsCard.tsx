// The organisation's results outside the 5-tier wizard, on the dashboard: CRAFT-ONC (its own answers and the
// independent assessor's) and each Capacity Assessment, drafts included. Without this an organisation that only
// answered these saw an empty dashboard.
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardContent } from './ui'
import { useAuthCtx, useScoresCtx, useWorkspace } from '../lib/context'
import { answeredCount } from '../lib/data'
import { dashboard, effectiveNotAssessed, type CcaModule, type NotAssessed, type Responses } from '../lib/cca/engine'

type Assessment = { id: string; module: string; year: number; status: string; responses: Responses; notAssessed?: NotAssessed; domainIds?: string[] | null; updatedAt?: string }
const LEVEL: Record<string, string> = { Nascent: 'bg-rose-100 text-rose-800', Emerging: 'bg-amber-100 text-amber-800', Expanding: 'bg-sky-100 text-sky-800', Mature: 'bg-emerald-100 text-emerald-800' }

const onc = (s: Record<string, number> | undefined) => {
  const v = Object.entries(s ?? {}).filter(([k]) => k.startsWith('CRAFT-ONC-')).map(([, n]) => n)
  return v.length ? { n: v.length, avg: v.reduce((a, b) => a + b, 0) / v.length } : null
}

export function OtherAssessmentsCard({ orgId, signedIn }: { orgId: string; signedIn: boolean }) {
  const { scores, assessorScores } = useScoresCtx()
  const { readOnly: viewing } = useWorkspace()
  const { currentUser } = useAuthCtx()
  // An independent assessor or a reviewer sees the links; only the organisation sets them.
  const readOnly = viewing || currentUser?.role === 'independent'
  // Which award (grant) each assessment is for; the organisation's own people set it, others see it.
  const [awards, setAwards] = useState<{ id: string; title: string; funderName: string }[]>([])
  const [links, setLinks] = useState<Record<string, string>>({})
  const [linkError, setLinkError] = useState('')
  useEffect(() => {
    if (!signedIn || !orgId) return
    fetch(`/api/awards?orgId=${encodeURIComponent(orgId)}`).then((r) => (r.ok ? r.json() : { awards: [] })).then((b) => setAwards(b.awards ?? []), () => {})
    fetch(`/api/assessment-links?orgId=${encodeURIComponent(orgId)}`).then((r) => (r.ok ? r.json() : { links: {} })).then((b) => setLinks(b.links ?? {}), () => {})
  }, [orgId, signedIn])
  const link = async (assessment: string, awardId: string) => {
    setLinkError('')
    const r = await fetch('/api/assessment-links', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orgId, assessment, awardId }) })
    if (r.ok) setLinks({ ...links, [assessment]: awardId })
    else setLinkError(r.status === 403 ? 'Only the organisation can choose which grant an assessment is for.' : 'The grant could not be saved.')
  }
  const awardLabel = (id?: string) => { const a = awards.find((x) => x.id === id); return a ? `${a.title}${a.funderName ? ` (${a.funderName})` : ''}` : '' }
  const ForGrant = ({ k }: { k: string }) => !awards.length ? null : readOnly
    ? <p className="text-xs text-slate-500">{links[k] ? `For grant: ${awardLabel(links[k])}` : 'Not linked to a grant'}</p>
    : (
      <label className="mt-1 flex items-center gap-2 text-xs text-slate-500">For grant
        <select value={links[k] ?? ''} onChange={(e) => void link(k, e.target.value)} className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-700">
          <option value="">Not linked</option>
          {awards.map((a) => <option key={a.id} value={a.id}>{awardLabel(a.id)}</option>)}
        </select>
      </label>
    )
  const wizardAnswered = answeredCount(scores[orgId] ?? {})
  // The organisation's steps, done and to do (the same list its progress messages use).
  const [steps, setSteps] = useState<{ id: string; title: string; how: string; done: boolean }[]>([])
  useEffect(() => {
    if (!signedIn || !orgId) return
    fetch(`/api/progress?orgId=${encodeURIComponent(orgId)}`).then((r) => (r.ok ? r.json() : { steps: [] })).then((d) => setSteps(d.steps ?? []), () => {})
  }, [orgId, signedIn])
  const [cca, setCca] = useState<{ modules: CcaModule[]; assessments: Assessment[] } | null>(null)
  useEffect(() => {
    if (!signedIn || !orgId) return
    let live = true
    Promise.all([
      fetch('/api/cca/modules').then((r) => (r.ok ? r.json() : { modules: [] })),
      fetch(`/api/cca?orgId=${encodeURIComponent(orgId)}`).then((r) => (r.ok ? r.json() : { assessments: [] })),
    ]).then(([m, a]) => { if (live) setCca({ modules: m.modules ?? [], assessments: a.assessments ?? [] }) }).catch(() => {})
    return () => { live = false }
  }, [orgId, signedIn])

  const self = onc(scores[orgId])
  const indep = onc(assessorScores[orgId])
  const capacity = (cca?.assessments ?? []).flatMap((a) => {
    const m = cca!.modules.find((x) => x.id === a.module)
    return m ? [{ a, m, d: dashboard(m, a.responses, effectiveNotAssessed(m, a.notAssessed, a.domainIds)) }] : []
  }).sort((x, y) => y.a.year - x.a.year)
  if (!self && !indep && !capacity.length && !wizardAnswered && !steps.length) return null

  const pct = (avg: number) => `${Math.round((avg / 5) * 100)}%`
  return (
    <Card>
      <CardHeader><CardTitle>Other assessments</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {(self || indep) && (
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-800">CRAFT Organisational &amp; Network Capacity Index</p>
              <p className="text-slate-600">
                {self ? `Own answers: ${self.n} of 44 indicators, average ${self.avg.toFixed(1)} of 5 (${pct(self.avg)})` : 'Not answered by the organisation yet'}
                {indep && ` · Independent assessor: ${indep.n} indicators, average ${indep.avg.toFixed(1)} of 5 (${pct(indep.avg)})`}
              </p>
              <ForGrant k="craft-onc" />
            </div>
            <Link to="/assessment/$frameworkId" params={{ frameworkId: 'craft-onc' }} className="text-emerald-700 underline">Open</Link>
          </div>
        )}
        {wizardAnswered > 0 && (
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-100 pt-3">
            <div>
              <p className="font-semibold text-slate-800">5-tier Assessment Wizard</p>
              <p className="text-slate-600">{wizardAnswered} questions answered; results are on this dashboard</p>
              <ForGrant k="wizard" />
            </div>
            <Link to="/assessment" className="text-emerald-700 underline">Open</Link>
          </div>
        )}
        {capacity.map(({ a, m, d }) => (
          <div key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-100 pt-3">
            <div>
              <p className="font-semibold text-slate-800">{m.name} Capacity Assessment {a.year}</p>
              <p className="text-slate-600">
                {a.status === 'complete' ? 'Complete' : 'Draft'} · average {d.average.toFixed(2)} of 4{' '}
                <span className={`ml-1 rounded px-2 py-0.5 text-xs font-semibold ${LEVEL[d.level] ?? 'bg-slate-100 text-slate-600'}`}>{d.level}</span>
              </p>
              <ForGrant k={`cca:${a.id}`} />
            </div>
            <Link to="/capacity" className="text-emerald-700 underline">Open</Link>
          </div>
        ))}
        {steps.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <p className="font-semibold text-slate-800">Your steps ({steps.filter((s) => s.done).length} of {steps.length} done)</p>
            <ul className="mt-1 space-y-0.5">
              {steps.map((s) => (
                <li key={s.id} className={s.done ? 'text-slate-500 line-through' : 'text-slate-700'}>
                  {s.done ? '✓' : '○'} {s.title}{!s.done && <span className="text-xs text-slate-500"> · {s.how}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {linkError && <p role="alert" className="text-xs text-rose-700">{linkError}</p>}
        {!readOnly && !awards.length && <p className="text-xs text-slate-500">To say which grant an assessment is for, add the grant under <Link to="/awards" className="underline">Awards &amp; Issues</Link>.</p>}
      </CardContent>
    </Card>
  )
}
