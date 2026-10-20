import { Globe2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Input, Select } from './ui'
import { useEntityProfileCtx, useWorkspace } from '../lib/context'
import { useLegacyAssessment } from '../lib/legacy-assessment'
import { NDCS, NDC_SECTORS, CONTRIBUTION_TYPES, assessContribution, type ContributionProfile, type ContributionType, type NdcSector } from '../lib/ndc'
import { jurisdictionName } from '../lib/laws/types'
import { checkTarget, targetFromSaved, type SavedTarget } from '../lib/netZero'

export type NdcSettings = ContributionProfile & { country: string }
export const NDC_KEY = 'esg:ndc'
export const emptyNdcSettings = (country: string): NdcSettings => ({ country, sectors: [], types: [], actions: '' })

function toggle<T>(list: T[], item: T, on: boolean): T[] { return on ? [...list, item] : list.filter((x) => x !== item) }

// How the organisation's actions relate to its country's nationally determined contribution (NDC).
export function NdcContributionCard() {
  const { entityProfile } = useEntityProfileCtx()
  const { readOnly } = useWorkspace()
  const [s, setS] = useLegacyAssessment<NdcSettings>(NDC_KEY, () => emptyNdcSettings(NDCS[entityProfile.country] ? entityProfile.country : 'NG'))
  const [savedTarget] = useLegacyAssessment<SavedTarget>('esg:netzero', {})
  const target = checkTarget(targetFromSaved(savedTarget))
  const c = assessContribution(s.country, s, target)
  const r = c?.record
  const set = (patch: Partial<NdcSettings>) => !readOnly && setS({ ...s, ...patch })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-emerald-600" /> Contribution to the national NDC</CardTitle>
        <p className="text-sm text-slate-600">How your work relates to the country's climate pledge under the Paris Agreement. Your actions contribute to or align with the NDC; only the government reports NDC progress.</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Country" value={s.country} onChange={(country) => set({ country })}
            options={Object.keys(NDCS).map((j) => ({ value: j, label: jurisdictionName(j) }))} />
          <Input label="What you do (briefly)" value={s.actions} disabled={readOnly} onChange={(e) => set({ actions: e.target.value })} placeholder="e.g. solar mini-grids for clinics" />
        </div>
        {r && (
          <div className="rounded border border-slate-200 p-3">
            <p className="font-medium text-slate-800">{r.submission ?? 'NDC'}{r.submitted ? ` · submitted ${r.submitted}` : ''}</p>
            <p className="text-slate-700">{r.target ?? 'No quantified greenhouse gas target found.'}{r.targetYear ? ` Target year: ${r.targetYear}.` : ''}</p>
            {r.notes && <p className="mt-1 text-xs text-amber-700">{r.notes}</p>}
          </div>
        )}
        <fieldset className="flex flex-wrap gap-3">
          <legend className="mb-1 text-xs font-medium text-slate-600">How you contribute</legend>
          {(Object.keys(CONTRIBUTION_TYPES) as ContributionType[]).map((t) => (
            <label key={t} className="flex items-center gap-1.5">
              <input type="checkbox" className="h-4 w-4 accent-emerald-600" disabled={readOnly} checked={s.types.includes(t)} onChange={(e) => set({ types: toggle(s.types, t, e.target.checked) })} />
              {CONTRIBUTION_TYPES[t]}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap gap-3">
          <legend className="mb-1 text-xs font-medium text-slate-600">Sectors you work in</legend>
          {(Object.keys(NDC_SECTORS) as NdcSector[]).map((k) => (
            <label key={k} className="flex items-center gap-1.5">
              <input type="checkbox" className="h-4 w-4 accent-emerald-600" disabled={readOnly} checked={s.sectors.includes(k)} onChange={(e) => set({ sectors: toggle(s.sectors, k, e.target.checked) })} />
              {NDC_SECTORS[k]}{r && (r.mitigation.includes(k) || r.adaptation.includes(k)) ? <span className="text-xs text-emerald-700"> (in NDC)</span> : null}
            </label>
          ))}
        </fieldset>
        {c && <ul className="list-disc space-y-1 pl-5 text-slate-800">{c.statements.map((t) => <li key={t}>{t}</li>)}</ul>}
        {s.types.includes('mitigation') && target.verdict === 'invalid' && <p className="text-xs text-slate-500">Add your emissions-reduction target in the ESG assessment's net-zero target check to see whether it is aligned with the NDC's mitigation goal.</p>}
        {c && <div className="space-y-1 text-xs text-slate-500">{c.caveats.map((t) => <p key={t}>{t}</p>)}
          <p>Source: <a className="underline" href={c.record.source.registry} target="_blank" rel="noreferrer">UNFCCC NDC Registry</a>; targets and sectors as analysed by Climate Watch (WRI), checked {c.record.source.checked}. Confirm against the NDC document.</p></div>}
      </CardContent>
    </Card>
  )
}
