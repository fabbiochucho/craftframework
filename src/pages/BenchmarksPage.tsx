import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button, Card, CardContent, CardHeader, CardTitle, Select } from '../components/ui'
import { benchmarksCsv, DIMENSIONS, SIZE_BANDS, type BenchmarkData, type Dimension, type GroupStats } from '../lib/benchmarks'
import { countryName } from '../lib/dataroom'

// The public benchmark explorer (no sign-in). Everything shown comes from /api/benchmarks: nightly aggregates of
// organisations that opted in, never a single organisation (src/lib/benchmarks.ts explains the safeguards).
const label = (dim: Dimension, value: string) =>
  dim === 'country' && value !== 'Other' ? countryName(value) || value
    : dim === 'size' ? SIZE_BANDS.find((b) => b.id === value)?.label ?? value
      : value

function Bar({ s }: { s: GroupStats }) {
  const pct = (v: number) => `${((v - 1) / 3) * 100}%`
  return (
    <div className="relative h-3 w-40 rounded bg-slate-100" aria-hidden>
      <div className="absolute inset-y-0 rounded bg-emerald-200" style={{ left: pct(s.q1), width: `calc(${pct(s.q3)} - ${pct(s.q1)})` }} />
      <div className="absolute inset-y-0 w-0.5 bg-emerald-800" style={{ left: pct(s.median) }} />
    </div>
  )
}

export function BenchmarksPage() {
  const [data, setData] = useState<BenchmarkData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [moduleId, setModuleId] = useState('')
  const [dim, setDim] = useState<Dimension>('country')
  useEffect(() => {
    fetch('/api/benchmarks').then(async (r) => {
      if (!r.ok) throw new Error('Benchmarks are unavailable right now.')
      const d = await r.json() as BenchmarkData
      setData(d); setModuleId(d.modules[0]?.id ?? '')
    }).catch((e) => setError((e as Error).message))
  }, [])
  const m = data?.modules.find((x) => x.id === moduleId)
  const csvHref = useMemo(() => data?.modules.length ? `data:text/csv;charset=utf-8,${encodeURIComponent(benchmarksCsv(data))}` : null, [data])
  const groups = m ? [{ value: 'All organisations', stats: m.overall! }, ...m.dimensions[dim].map((g) => ({ value: label(dim, g.value), stats: g.stats }))] : []

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-emerald-900">CRAFT Benchmarks</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          How organisations that chose to take part score on the CRAFT capacity assessment, by country, sector, organisation type and size.
          Scores run from 1 (nascent) to 4 (mature). Self-assessed and independently validated results are shown separately.
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {data && !data.modules.length && (
        <Card><CardContent className="py-8 text-sm text-slate-600">
          No results are published yet. A group appears once at least {data.minGroup ?? 5} organisations in it have completed an assessment and chosen to take part.
        </CardContent></Card>
      )}
      {m && (
        <Card>
          <CardHeader><CardTitle>Results</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="w-56"><Select label="Assessment module" value={moduleId} onChange={setModuleId} options={data!.modules.map((x) => ({ value: x.id, label: x.name }))} /></div>
              <div className="w-56"><Select label="Compare by" value={dim} onChange={(v) => setDim(v as Dimension)} options={DIMENSIONS.map((d) => ({ value: d.id, label: d.label }))} /></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Group</th><th className="pr-3">Organisations</th><th className="pr-3">Median</th><th className="pr-3">Middle half</th><th className="pr-3">Spread</th><th className="pr-3">Self-assessed</th><th>Validated</th>
                </tr></thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.value} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-800">{g.value}</td>
                      <td className="pr-3">{g.stats.organisations}</td>
                      <td className="pr-3 font-mono">{g.stats.median.toFixed(2)}</td>
                      <td className="pr-3 font-mono">{g.stats.q1.toFixed(2)}–{g.stats.q3.toFixed(2)}</td>
                      <td className="pr-3"><Bar s={g.stats} /></td>
                      <td className="pr-3 font-mono">{g.stats.selfAssessed ? g.stats.selfAssessed.median.toFixed(2) : '–'}</td>
                      <td className="font-mono">{g.stats.validated ? g.stats.validated.median.toFixed(2) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">– means fewer than {data!.minGroup} organisations, so the figure is withheld. Updated {new Date(data!.computedAt).toLocaleDateString()}.</p>
            {csvHref && <a href={csvHref} download="craft-benchmarks.csv"><Button variant="outline" size="sm">Download CSV</Button></a>}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>How these figures are made</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>Only organisations that opted in are included, using each one's latest completed assessment per module. An organisation can leave at any time; it is removed from the next nightly update.</p>
          <p>No group smaller than {data?.minGroup ?? 5} organisations is published. Small groups are combined into “Other”, which is itself shown only when large enough. Counts are given as ranges, only medians and quartiles are published, and groups are compared one dimension at a time, so no organisation can be singled out.</p>
          <p>“Validated” means the organisation holds a current independent CRAFT validation. Self-assessed scores are not adjusted. The figures describe the organisations that took part, not every organisation in a country or sector.</p>
          <p>The data is published under the Creative Commons Attribution 4.0 licence. To take part, open the <Link to="/capacity" className="text-emerald-700 underline">Capacity Assessment</Link> in your workspace.</p>
        </CardContent>
      </Card>
    </div>
  )
}
