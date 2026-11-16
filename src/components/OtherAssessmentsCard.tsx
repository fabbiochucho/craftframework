// The organisation's results outside the 5-tier wizard, on the dashboard: CRAFT-ONC (its own answers and the
// independent assessor's) and each Capacity Assessment, drafts included. Without this an organisation that only
// answered these saw an empty dashboard.
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle, CardContent } from './ui'
import { useScoresCtx } from '../lib/context'
import { dashboard, effectiveNotAssessed, type CcaModule, type NotAssessed, type Responses } from '../lib/cca/engine'

type Assessment = { id: string; module: string; year: number; status: string; responses: Responses; notAssessed?: NotAssessed; domainIds?: string[] | null; updatedAt?: string }
const LEVEL: Record<string, string> = { Nascent: 'bg-rose-100 text-rose-800', Emerging: 'bg-amber-100 text-amber-800', Expanding: 'bg-sky-100 text-sky-800', Mature: 'bg-emerald-100 text-emerald-800' }

const onc = (s: Record<string, number> | undefined) => {
  const v = Object.entries(s ?? {}).filter(([k]) => k.startsWith('CRAFT-ONC-')).map(([, n]) => n)
  return v.length ? { n: v.length, avg: v.reduce((a, b) => a + b, 0) / v.length } : null
}

export function OtherAssessmentsCard({ orgId, signedIn }: { orgId: string; signedIn: boolean }) {
  const { scores, assessorScores } = useScoresCtx()
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
  if (!self && !indep && !capacity.length) return null

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
            </div>
            <Link to="/assessment/$frameworkId" params={{ frameworkId: 'craft-onc' }} className="text-emerald-700 underline">Open</Link>
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
            </div>
            <Link to="/capacity" className="text-emerald-700 underline">Open</Link>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
