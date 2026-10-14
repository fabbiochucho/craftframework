import { Link } from '@tanstack/react-router'
import { wsPath } from '../../lib/workspaceApi'
import { Badge, Card, CardContent, Table, Tbody, Td, Th, Thead } from '../../components/ui'
import { Header, State, StatusPill, useApi } from './shared'

const pct = (v: number | null) => (v === null ? '—' : `${v}%`)

export function HealthSecurityPage({ workspaceId }: { workspaceId: string }) {
  const cat = useApi<any>(wsPath(workspaceId, '/health-security/catalogue'))
  const ov = useApi<any>(wsPath(workspaceId, '/health-security/overview'))
  const assessments = { to: '/app/workspaces/$workspaceId/governance/assessments', params: { workspaceId } } as const
  if (!cat.data) return <State loading={cat.loading} error={cat.error} />
  const available: string[] = cat.data.available
  return (
    <div className="space-y-6">
      <Header title="Health security" subtitle="NPHI development (Africa CDC), WHO JEE and SPAR, subnational JEE-style self-assessment, after-action reviews and simulation exercises."
        back={{ to: '/app/workspaces/$workspaceId/dashboard', params: { workspaceId }, label: 'Dashboard' }} />
      {!available.length ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">These assessments are available to organisations registered as a <b>national public health institute</b> (all assessments) or a <b>subnational government</b> (subnational JEE, after-action reviews, simulation exercises). An admin can set the organisation type in Organization settings.</p>
      ) : (
        <p className="text-sm text-slate-700">Available here: {available.map(t => cat.data.labels[t]).join(' · ')}. Start one from <Link className="text-emerald-700 underline" {...assessments}>Governance assessments</Link>.</p>
      )}
      <State loading={ov.loading} error={ov.error} />
      {ov.data?.summary.length > 0 && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {ov.data.summary.map((s: any) => (
          <Card key={s.type}><CardContent className="space-y-1 text-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">{s.label}</p>
            <p className="text-3xl font-bold text-emerald-900">{pct(s.overall)}</p>
            <p>v{s.version}{s.reportingPeriod && ` · ${s.reportingPeriod}`} · <StatusPill value={s.status} /> · {s.completeness}% complete</p>
            {s.sdg && <p className="text-xs text-slate-600">{s.sdg.indicator}</p>}
            <Link className="text-emerald-700 underline" to="/app/workspaces/$workspaceId/governance/assessments/$assessmentId" params={{ workspaceId, assessmentId: String(s.assessmentId) }}>Open</Link>
          </CardContent></Card>))}
      </div>}
      <h2 className="text-lg font-semibold">Crosswalk: SPAR ↔ JEE ↔ NPHI</h2>
      <p className="text-sm text-slate-600">Latest approved (or most recent) assessment of each type. A large spread between instruments for the same capacity is worth investigating before reporting.</p>
      <Table><Thead><tr><Th>Theme</Th><Th>SPAR</Th><Th>JEE areas</Th><Th>NPHI items</Th><Th>SPAR %</Th><Th>JEE %</Th><Th>NPHI %</Th><Th>Spread</Th></tr></Thead>
        <Tbody>{(ov.data?.crosswalk ?? cat.data.crosswalk).map((r: any) => (
          <tr key={r.theme}><Td>{r.theme}</Td><Td>{r.spar ?? '—'}</Td><Td>{r.jee.join(', ')}</Td><Td>{r.nphi.join(', ') || '—'}</Td>
            <Td>{pct(r.sparPercent ?? null)}</Td><Td>{pct(r.jeePercent ?? null)}</Td><Td>{pct(r.nphiPercent ?? null)}</Td>
            <Td>{r.spread == null ? '—' : <Badge className={r.spread >= 40 ? 'bg-rose-100 text-rose-700' : r.spread >= 20 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}>{r.spread}</Badge>}</Td></tr>))}</Tbody></Table>
    </div>
  )
}
