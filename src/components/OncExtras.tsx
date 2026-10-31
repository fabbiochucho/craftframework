import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Scale } from 'lucide-react'
import { Card } from './ui'
import { useEntityProfileCtx } from '../lib/context'
import { lawsFor } from '../lib/laws/register'
import { applyApprovals } from '../lib/laws/jurisdictionReport'
import { useLawApprovals } from '../lib/laws/useLawApprovals'
import { LAW_AREAS } from '../lib/laws/types'
import { AFRICA_COUNTRIES } from '../lib/africa-countries'
import { ONC_LAW_AREAS, byNhocatDomain, maturityLevel } from '../lib/indices/craftOnc'

// CRAFT-ONC extras: the questions are written for any country; these show the organisation's own country's laws
// (reviewed entries from the laws register) and read the results across to NHOCAT's domains and four levels.

const countryName = (iso: string) => AFRICA_COUNTRIES.find((c) => c.iso2 === iso)?.name ?? iso

/** Under a question: the laws that apply in the organisation's country for that area. */
export function CountryLaws({ indicatorId }: { indicatorId: string }) {
  const areas = ONC_LAW_AREAS[indicatorId]
  const { entityProfile } = useEntityProfileCtx()
  const { approved } = useLawApprovals()
  const iso = entityProfile.country
  const laws = useMemo(() => {
    if (!areas || !iso) return []
    return applyApprovals(lawsFor([iso]), approved).filter((e) => e.review === 'approved' && !e.noLaw && areas.includes(e.area))
  }, [areas, iso, approved])
  if (!areas) return null
  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
      <p className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-slate-500"><Scale className="h-3.5 w-3.5" aria-hidden /> {iso ? `In ${countryName(iso)}` : 'In your country'}</p>
      {!iso && <p className="mt-1">Set your country in <Link to="/settings" className="text-emerald-700 underline">Settings</Link> to see the laws that apply ({areas.map((a) => LAW_AREAS[a].toLowerCase()).join(', ')}).</p>}
      {iso && laws.length === 0 && <p className="mt-1">CRAFT's laws register has no reviewed entry for {areas.map((a) => LAW_AREAS[a].toLowerCase()).join(' or ')} in {countryName(iso)} yet. Check with the national registration authority.</p>}
      {laws.length > 0 && (
        <ul className="mt-1 space-y-1">
          {laws.slice(0, 4).map((l) => (
            <li key={l.id}>
              <a href={l.source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-800 underline">{l.title}</a>
              {l.regulator ? <span> · {l.regulator}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const LEVEL_STYLE: Record<string, string> = {
  Latent: 'bg-rose-100 text-rose-800', Emerging: 'bg-amber-100 text-amber-800', Established: 'bg-yellow-100 text-yellow-800', Advanced: 'bg-emerald-100 text-emerald-800',
}

/** Results read across to the eight NHOCAT domains and the four-level maturity scale. */
export function NhocatReading({ scores }: { scores: Record<string, number> }) {
  const rows = byNhocatDomain(scores)
  if (rows.every((r) => r.score == null)) return null
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-slate-900">Read across to NHOCAT domains</h2>
      <p className="mt-1 text-xs text-slate-500">
        The same answers, grouped under the eight domains of Nigeria's National Harmonised Organisational Capacity Assessment Tool and shown on a four-level scale
        (Latent, Emerging, Established, Advanced). This is a read-across, not an NHOCAT assessment.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="py-1 pr-3">NHOCAT domain</th><th className="pr-3">Score (0-5)</th><th>Level</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.domain} className="border-t border-slate-100">
                <td className="py-1.5 pr-3 text-slate-800">{r.label}</td>
                <td className="pr-3 tabular-nums text-slate-700">{r.score == null ? '—' : r.score.toFixed(2)}</td>
                <td>{r.score == null ? <span className="text-xs text-slate-400">Not answered</span> : <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL_STYLE[maturityLevel(r.score)]}`}>{maturityLevel(r.score)}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
