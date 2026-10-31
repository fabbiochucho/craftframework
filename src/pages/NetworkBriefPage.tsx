import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Printer } from 'lucide-react'
import { Button } from '../components/ui'

// A one-page brief for funders and government: totals only (never names), from the round's results and plan.

async function get<T = any>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`)
  return body as T
}

export function NetworkBriefPage({ networkId, roundId }: { networkId: string; roundId: string }) {
  const [r, setR] = useState<any>(null)
  const [plan, setPlan] = useState<any>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    void get(`/api/network-results/${roundId}`).then(setR, (e) => setError(e.message))
    void get(`/api/network-results/${roundId}/plan`).then(setPlan, () => setPlan(null))
  }, [roundId])
  if (error) return <p className="text-sm text-rose-700">{error}</p>
  if (!r) return <p className="text-slate-500">Loading…</p>
  if (r.role !== 'coordinator') return <p className="text-sm text-slate-600">Only network coordinators can produce the brief.</p>
  const c = r.capacity
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <div className="mx-auto max-w-3xl space-y-5 bg-white print:max-w-none">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Link to="/networks/$networkId" params={{ networkId }} className="text-sm text-emerald-700 hover:underline">← Back to the network</Link>
        <Button size="sm" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" aria-hidden /> Print or save as PDF</Button>
      </div>
      <header className="border-b border-slate-200 pb-3">
        <p className="text-xs uppercase tracking-wide text-emerald-700">CRAFT network brief · {date}</p>
        <h1 className="text-2xl font-bold text-slate-900">{r.node.name}: {r.round.name}</h1>
        <p className="text-sm text-slate-600">{r.round.instrumentTitle}. Totals only: no organisation is named, and any group under {r.minGroup} members is withheld.</p>
      </header>
      <section>
        <h2 className="text-base font-semibold text-slate-900">In brief</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-800">{r.scorecard.map((l: string) => <li key={l}>{l}</li>)}</ul>
      </section>
      <section>
        <h2 className="text-base font-semibold text-slate-900">Coverage</h2>
        <p className="text-sm text-slate-800">{r.use.map((u: any) => `${u.label}: ${u.count}`).join(' · ')}</p>
      </section>
      {!c.suppressed && (
        <section>
          <h2 className="text-base font-semibold text-slate-900">Readiness by area (median, 0-5)</h2>
          <table className="mt-1 w-full text-sm">
            <tbody>{c.dimensions.map((d: any) => <tr key={d.key} className="border-t border-slate-100"><td className="py-1 pr-3">{d.name}</td><td className="tabular-nums">{d.stats?.median.toFixed(2) ?? '—'}</td></tr>)}</tbody>
          </table>
          <p className="mt-1 text-sm text-slate-700">Members by band: {c.bands.filter((b: any) => b.count).map((b: any) => `${b.label} ${b.count}`).join(', ')}.</p>
        </section>
      )}
      {plan?.plan?.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-slate-900">Priorities for support</h2>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-800">
            {plan.plan.slice(0, 5).map((a: any) => <li key={a.key}><span className="font-medium">{a.name}</span>: {a.membersBelow} members ({a.share}%). {a.support}</li>)}
          </ol>
        </section>
      )}
      <footer className="border-t border-slate-200 pt-3 text-xs text-slate-500">
        CRAFT measures readiness; it does not certify or guarantee. Prepared with CRAFT, the Capacity Readiness and Fiduciary Assurance Toolkit of the DiBadili Institute. craftframework.becomechange.institute
      </footer>
    </div>
  )
}
