import { useMemo, useState } from 'react'
import { Landmark } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from './ui'
import { useEntityProfileCtx } from '../lib/context'
import type { Obligation } from '../lib/obligations'
import { FILING_GAPS, FILING_JURISDICTIONS, filingsFor, nextDue, toObligation, type EntityKind } from '../lib/filings'
import { jurisdictionName } from '../lib/laws/types'

const KINDS: Array<{ id: EntityKind; label: string }> = [
  { id: 'company', label: 'Registered company' },
  { id: 'ngo', label: 'NGO / incorporated trustees' },
  { id: 'business-name', label: 'Business name' },
  { id: 'employer', label: 'Employs staff' },
  { id: 'vat-registered', label: 'Registered for VAT' },
]
const DEFAULT_KINDS: Record<string, EntityKind[]> = {
  Private: ['company', 'employer', 'vat-registered'], 'Civil Society': ['ngo', 'employer'], Public: ['employer'],
}

// Recurring statutory filings for the organisation's country: company registry returns, tax, payroll and AML.
export function StatutoryFilingsCard({ existing, onAdd, readOnly }: { existing: Obligation[]; onAdd: (list: Obligation[], message: string) => void; readOnly: boolean }) {
  const { entityProfile } = useEntityProfileCtx()
  const [country, setCountry] = useState(FILING_JURISDICTIONS.includes(entityProfile.country) ? entityProfile.country : FILING_JURISDICTIONS[0])
  const [kinds, setKinds] = useState<EntityKind[]>(DEFAULT_KINDS[entityProfile.archetype] ?? ['company', 'employer'])
  const [yearEnd, setYearEnd] = useState('12-31')
  const today = new Date().toISOString().slice(0, 10)
  const ctx = { today, yearEnd: /^\d{2}-\d{2}$/.test(yearEnd) ? yearEnd : '12-31' }
  const list = useMemo(() => filingsFor(country, kinds), [country, kinds])
  const have = new Set(existing.map((o) => `${o.country}|${o.name}`))
  const dated = list.filter((f) => nextDue(f, ctx) && !have.has(`${f.jurisdiction}|${f.name}`))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Landmark className="h-4 w-4 text-emerald-600" /> Statutory filings</CardTitle>
        <p className="text-sm text-slate-600">Recurring returns and remittances the law requires: company registry, tax, payroll and anti-money-laundering. Information, not legal or tax advice; check the source.</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {FILING_GAPS[entityProfile.country] && <p className="rounded bg-amber-50 p-2 text-amber-800">{jurisdictionName(entityProfile.country)}: {FILING_GAPS[entityProfile.country]}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="Country" value={country} onChange={setCountry} options={FILING_JURISDICTIONS.map((j) => ({ value: j, label: jurisdictionName(j) }))} />
          <Input label="Financial year end (MM-DD)" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} placeholder="12-31" />
        </div>
        <fieldset className="flex flex-wrap gap-3">
          <legend className="sr-only">Organisation type</legend>
          {KINDS.map((k) => (
            <label key={k.id} className="flex items-center gap-1.5">
              <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={kinds.includes(k.id)} onChange={(e) => setKinds(e.target.checked ? [...kinds, k.id] : kinds.filter((x) => x !== k.id))} />
              {k.label}
            </label>
          ))}
        </fieldset>
        <ul className="divide-y divide-slate-100">
          {list.map((f) => {
            const due = nextDue(f, ctx)
            return (
              <li key={f.id} className="py-2">
                <p className="font-medium text-slate-800">{f.name} <span className="font-normal text-slate-500">· {f.authority}</span></p>
                <p className="text-slate-700">{f.dueText}{due ? <> Next due: <strong>{due}</strong>.</> : null}</p>
                <p className="text-xs text-slate-500">{f.legalBasis}{f.notes ? `. ${f.notes}` : ''} · <a href={f.source.url} target="_blank" rel="noreferrer" className="underline">Source</a>{f.source.kind === 'secondary' ? ' (secondary, verify)' : ''} · checked {f.source.checked}</p>
              </li>
            )
          })}
          {list.length === 0 && <li className="py-2 text-slate-500">Choose what kind of organisation you are.</li>}
        </ul>
        {!readOnly && (
          <Button size="sm" disabled={dated.length === 0} onClick={() => onAdd(dated.map((f) => toObligation(f, ctx, 'Finance Manager')), `Added ${dated.length} statutory filing${dated.length === 1 ? '' : 's'} to the register.`)}>
            {dated.length ? `Add ${dated.length} dated filing${dated.length === 1 ? '' : 's'} to the register` : 'All dated filings are in the register'}
          </Button>
        )}
        <p className="text-xs text-slate-500">Filings tied to an event (a payday, the AGM) are listed as guidance, without a calendar date.</p>
      </CardContent>
    </Card>
  )
}
