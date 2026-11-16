import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Printer, Scale } from 'lucide-react'
import { Card } from './ui'
import { useEntityProfileCtx, useScoresCtx, useWorkspace } from '../lib/context'
import { buildNhocatReportHtml } from '../lib/nhocatReport'
import { fetchAssessorView, saveAssessorReportName, type AssessorView } from '../lib/api'
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
  const { currentOrg } = useWorkspace()
  const { entityProfile } = useEntityProfileCtx()
  const { assessorScores } = useScoresCtx()
  const [assessor, setAssessor] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const orgId = currentOrg?.id ?? ''
  // Fill the header from the independent assessment on record; both fields stay editable.
  const [view, setView] = useState<AssessorView | null>(null)
  useEffect(() => {
    if (!orgId) return
    let live = true
    void fetchAssessorView(orgId).then((v) => {
      if (!live) return
      setView(v)
      if (v.assessor) setAssessor((a) => a || v.assessor!.name || v.assessor!.email)
      if (v.assessedOn) setDate(v.assessedOn)
    })
    return () => { live = false }
  }, [orgId])
  // Keep a typed assessor name for next time (stored on the assessor's grant for this organisation).
  const [nameMsg, setNameMsg] = useState('')
  const savedName = view?.assessor ? view.assessor.name || view.assessor.email : ''
  const saveName = () => {
    if (!view?.assessor) return
    const name = assessor.trim()
    saveAssessorReportName(orgId, view.assessor.email, name).then(
      () => { setView({ ...view, assessor: { ...view.assessor!, name } }); setNameMsg('Saved') },
      () => setNameMsg('Could not save the name'),
    )
  }
  const printReport = () => {
    const html = buildNhocatReportHtml({
      orgName: currentOrg?.name || 'Organisation',
      orgEmail: currentOrg?.email || '',
      orgType: [entityProfile.archetype, entityProfile.sector].filter(Boolean).join(' · '),
      scores, independent: { ...(view?.scores ?? {}), ...(assessorScores[orgId] ?? {}) },
      evidenceSighted: view?.notes,
      assessor, date: date || undefined,
    })
    const w = window.open('', '_blank')
    if (!w) return
    w.document.open(); w.document.write(html); w.document.close()
    w.focus(); setTimeout(() => w.print(), 300)
  }
  if (rows.every((r) => r.score == null)) return null
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Read across to NHOCAT domains</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-600">Assessor{' '}
            <input value={assessor} onChange={(e) => setAssessor(e.target.value)} maxLength={200} placeholder="Name or firm" className="ml-1 w-40 rounded border border-slate-300 px-2 py-1 text-xs" />
          </label>
          {view?.assessor && assessor.trim() && assessor.trim() !== savedName && (
            <button type="button" onClick={saveName} className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Use this name on reports</button>
          )}
          {nameMsg && <span role="status" className="text-xs text-slate-500">{nameMsg}</span>}
          <label className="text-xs text-slate-600">Date of assessment{' '}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ml-1 rounded border border-slate-300 px-2 py-1 text-xs" />
          </label>
        <button type="button" onClick={printReport} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">
          <Printer className="h-3.5 w-3.5" /> Print NHOCAT-style report
        </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        The same answers, grouped under the eight domains of Nigeria's National Harmonised Organisational Capacity Assessment Tool and shown on a four-level scale
        (Latent, Emerging, Established, Advanced). CRAFT adopts the NHOCAT+ tool methodology and other frameworks to assess and strengthen organisations.
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
