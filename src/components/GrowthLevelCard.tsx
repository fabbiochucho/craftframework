// Capacity growth level next to CRAFT's other results: evidenced (from the latest completed Capacity Assessment) or,
// without one, indicative (CRAFT's composite converted onto the 1–4 scale). See src/lib/cca/crosswalk.ts.
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent } from './ui'
import { evidencedLevel, indicativeLevel } from '../lib/cca/crosswalk'
import { CCA_MODULES } from '../lib/cca/modules'
import type { CcaModule } from '../lib/cca/engine'

const STYLE: Record<string, string> = { Nascent: 'bg-rose-100 text-rose-800', Emerging: 'bg-amber-100 text-amber-800', Expanding: 'bg-sky-100 text-sky-800', Mature: 'bg-emerald-100 text-emerald-800', 'Not assessed': 'bg-slate-100 text-slate-600' }

export function GrowthLevelCard({ orgId, composite, signedIn }: { orgId: string; composite: number; signedIn: boolean }) {
  const [evidenced, setEvidenced] = useState<ReturnType<typeof evidencedLevel>>(null)
  useEffect(() => {
    if (!signedIn || !orgId) return
    let live = true
    Promise.all([
      fetch('/api/cca/modules').then((r) => (r.ok ? r.json() : { modules: [] })),
      fetch(`/api/cca?orgId=${encodeURIComponent(orgId)}`).then((r) => (r.ok ? r.json() : { assessments: [] })),
    ]).then(([m, a]) => { if (live) setEvidenced(evidencedLevel(a.assessments ?? [], (m.modules ?? []) as CcaModule[])) }).catch(() => {})
    return () => { live = false }
  }, [orgId, signedIn])
  const indicative = indicativeLevel(composite)
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 pt-5 text-sm">
        <span className="font-semibold text-slate-800">Capacity growth level</span>
        {evidenced ? (
          <>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STYLE[evidenced.level]}`}>{evidenced.level}</span>
            <span className="text-slate-600">average {evidenced.score.toFixed(2)} of 4 · from your {evidenced.year} {CCA_MODULES.find((m) => m.id === evidenced.module)?.name} Capacity Assessment (evidenced)</span>
          </>
        ) : (
          <>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STYLE[indicative.level]}`}>{indicative.level} (indicative)</span>
            <span className="text-slate-600">{indicative.score.toFixed(2)} of 4, converted from your composite score. <Link to="/capacity" className="text-emerald-700 underline">Complete a Capacity Assessment</Link> for an evidenced level.</span>
          </>
        )}
      </CardContent>
    </Card>
  )
}
