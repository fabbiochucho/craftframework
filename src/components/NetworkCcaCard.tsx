// Capacity Assessment results across a network level, for its coordinators and viewers. Rules: src/lib/cca/networkFeed.ts.
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Select } from './ui'
import { cn } from '../lib/utils'
import { CCA_MODULES } from '../lib/cca/modules'
import type { NetworkCcaFeed } from '../lib/cca/networkFeed'

type Feed = NetworkCcaFeed & { module: { id: string; name: string } }
const LEVEL_STYLE: Record<string, string> = { Nascent: 'bg-rose-100 text-rose-800', Emerging: 'bg-amber-100 text-amber-800', Expanding: 'bg-sky-100 text-sky-800', Mature: 'bg-emerald-100 text-emerald-800', 'Not assessed': 'bg-slate-100 text-slate-600' }

export function NetworkCcaCard({ nodes, roots }: { nodes: Array<{ id: string; name: string }>; roots: string[] }) {
  const own = nodes.filter((n) => roots.includes(n.id))
  const [nodeId, setNodeId] = useState(own[0]?.id ?? '')
  const [moduleId, setModuleId] = useState('community')
  const [feed, setFeed] = useState<Feed | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!nodeId) return
    setFeed(null); setError(null)
    fetch(`/api/network-cca?nodeId=${encodeURIComponent(nodeId)}&module=${encodeURIComponent(moduleId)}`, { cache: 'no-store' })
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error ?? `Request failed (${r.status})`); setFeed(b) })
      .catch((e) => setError((e as Error).message))
  }, [nodeId, moduleId])
  if (!own.length) return null
  const rows = feed ? [feed.overall, ...feed.children] : []
  return (
    <Card>
      <CardHeader>
        <CardTitle>Capacity Assessment results</CardTitle>
        <p className="text-sm text-slate-500">Members’ latest completed whole-organisation assessments. A group of fewer than {feed?.minGroup ?? 5} organisations is hidden unless every member in it chose named results; organisations are named only if they chose named results.</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          {own.length > 1 && <Select label="Level" value={nodeId} onChange={setNodeId} options={own.map((n) => ({ value: n.id, label: n.name }))} />}
          <Select label="Module" value={moduleId} onChange={setModuleId} options={CCA_MODULES.filter((m) => m.stage !== 'award').map((m) => ({ value: m.id, label: m.name }))} />
        </div>
        {error && <p role="alert" className="text-rose-700">{error}</p>}
        {!feed && !error && <p className="text-slate-500">Loading…</p>}
        {feed && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Level</th><th>Members</th><th>With results</th>{feed.overall.areas?.map((a) => <th key={a.id} className="px-1">{a.name}</th>)}<th>Overall</th></tr></thead>
              <tbody>{rows.map((g, i) => (
                <tr key={g.nodeId} className={cn('border-t border-slate-100', i === 0 && 'font-semibold')}>
                  <td className="py-1.5">{g.name}</td><td>{g.members}</td><td>{g.withResults}</td>
                  {g.shown ? g.areas!.map((a) => <td key={a.id} className="px-1 tabular-nums">{a.level === 'Not assessed' ? '–' : `${a.percent}%`}</td>)
                    : <td colSpan={feed.overall.areas?.length ?? 1} className="text-xs text-slate-500">Hidden: too few members with results</td>}
                  <td>{g.shown && g.level ? <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', LEVEL_STYLE[g.level])}>{g.percent}% {g.level}</span> : '–'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {feed && feed.named.length > 0 && (
          <div><p className="font-medium">Members who chose named results</p>
            <ul className="list-disc pl-5">{feed.named.map((n) => <li key={n.orgId}>{n.name}: {n.year}, {n.percent}% <span className={cn('rounded px-1.5 text-xs', LEVEL_STYLE[n.level])}>{n.level}</span></li>)}</ul></div>
        )}
      </CardContent>
    </Card>
  )
}
