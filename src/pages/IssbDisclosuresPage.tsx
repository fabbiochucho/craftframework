import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { Leaf, Building2, Target, ShieldAlert, Info, Factory } from 'lucide-react'
import {
  Card, CardContent, Badge, Input, Select, Tabs,
} from '../components/ui'
import { cn } from '../lib/utils'
import {
  DISCLOSURE_PILLARS, CLIMATE_SCENARIOS, netScenarioImpact,
  MATERIALITY_LABEL, MaterialityLens, HIGH_IMPACT_SECTORS,
  ScopeEmissions, EmissionState, scope3RedFlag,
} from '../lib/issb'

// ISSB S1/S2 + EU CSRD sustainability disclosure surface, structured around the
// 4 TCFD-aligned pillars with a climate-scenario visualizer and Scope 1/2/3
// tracker (with the mandatory Scope 3 red-flag for high-impact sectors).
export function IssbDisclosuresPage() {
  const [lens, setLens] = useState<MaterialityLens>('double')
  const [tab, setTab] = useState('pillars')
  const [sector, setSector] = useState<string>('Oil & Gas')
  const [emissions, setEmissions] = useState<ScopeEmissions>({
    scope1: undefined, scope2: undefined, scope3State: 'not_tracked', scope3: undefined,
  })

  const flag = useMemo(() => scope3RedFlag(sector, emissions), [sector, emissions])

  const scenarioData = useMemo(
    () => CLIMATE_SCENARIOS.map(s => ({
      name: s.label,
      net: netScenarioImpact(s),
      physical: s.physicalRiskPct,
      transition: s.transitionRiskPct,
      opportunity: s.opportunityPct,
      narrative: s.narrative,
    })),
    [],
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
          <Leaf className="h-4 w-4" /> Sustainability Disclosure Engine
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">
          ISSB S1/S2 &amp; CSRD Disclosures
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Structured around the four pillars — Governance, Strategy, Risk Management and Metrics &amp; Targets —
          accommodating both the ISSB single-materiality lens and the EU CSRD double-materiality lens.
        </p>
      </header>

      {/* Materiality lens toggle */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Info className="h-4 w-4 text-slate-400" /> Reporting lens
          </div>
          <div className="flex gap-2">
            {(['single', 'double'] as MaterialityLens[]).map(l => (
              <button
                key={l}
                onClick={() => setLens(l)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                  lens === l
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                )}
              >
                {MATERIALITY_LABEL[l]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <Tabs
          tabs={[
            { id: 'pillars', label: '4 Pillars' },
            { id: 'scenario', label: 'Climate Scenario Analysis' },
            { id: 'emissions', label: 'Scope 1/2/3 Metrics' },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'pillars' && (
        <div className="grid gap-4 md:grid-cols-2">
          {DISCLOSURE_PILLARS.map(p => (
            <Card key={p.key}>
              <CardContent className="py-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold text-slate-800">{p.title}</h3>
                  <Badge className="border border-emerald-200 bg-emerald-50 font-mono text-[10px] text-emerald-700">
                    {p.standard}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{p.description}</p>
                <ul className="mt-3 space-y-1.5">
                  {p.requirements.map(r => (
                    <li key={r} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === 'scenario' && (
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              <h3 className="font-display text-lg font-semibold text-slate-800">
                Financial Impact by Warming Scenario
              </h3>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Net illustrative impact on EBITDA under 1.5°C, 2°C and &gt;3°C warming pathways (physical + transition + opportunity).
            </p>
            <div className="mt-5 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scenarioData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="%" />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(value) => [`${value}%`, 'Net EBITDA impact']}
                  />
                  <Bar dataKey="net" radius={[6, 6, 0, 0]}>
                    {scenarioData.map((d, i) => (
                      <Cell key={i} fill={d.net <= -12 ? '#f43f5e' : d.net < 0 ? '#f59e0b' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {CLIMATE_SCENARIOS.map(s => (
                <div key={s.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">{s.label}</p>
                  <p className="mt-1 text-xs text-slate-600">{s.narrative}</p>
                  <p className="mt-2 font-mono text-xs text-slate-500">
                    Physical {s.physicalRiskPct}% · Transition {s.transitionRiskPct}% · Opportunity +{s.opportunityPct}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'emissions' && (
        <div className="space-y-5">
          <Card>
            <CardContent className="py-5">
              <div className="flex items-center gap-2">
                <Factory className="h-5 w-5 text-emerald-600" />
                <h3 className="font-display text-lg font-semibold text-slate-800">GHG Emissions Inventory</h3>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Select
                  label="Sector"
                  value={sector}
                  onChange={setSector}
                  options={[
                    ...HIGH_IMPACT_SECTORS.map(s => ({ value: s, label: s })),
                    { value: 'Financial Services', label: 'Financial Services' },
                    { value: 'Technology', label: 'Technology' },
                  ]}
                />
                <Input
                  label="Scope 1 — Direct (tCO₂e)"
                  type="number"
                  value={emissions.scope1 ?? ''}
                  onChange={e => setEmissions(s => ({ ...s, scope1: e.target.value === '' ? undefined : Number(e.target.value) }))}
                />
                <Input
                  label="Scope 2 — Indirect energy (tCO₂e)"
                  type="number"
                  value={emissions.scope2 ?? ''}
                  onChange={e => setEmissions(s => ({ ...s, scope2: e.target.value === '' ? undefined : Number(e.target.value) }))}
                />
                <Select
                  label="Scope 3 — Value chain"
                  value={emissions.scope3State}
                  onChange={v => setEmissions(s => ({ ...s, scope3State: v as EmissionState }))}
                  options={[
                    { value: 'tracked', label: 'Tracked' },
                    { value: 'not_tracked', label: 'Not Tracked' },
                    { value: 'not_applicable', label: 'Not Applicable' },
                  ]}
                />
              </div>
              {emissions.scope3State === 'tracked' && (
                <div className="mt-4 max-w-xs">
                  <Input
                    label="Scope 3 — Value chain (tCO₂e)"
                    type="number"
                    value={emissions.scope3 ?? ''}
                    onChange={e => setEmissions(s => ({ ...s, scope3: e.target.value === '' ? undefined : Number(e.target.value) }))}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {flag.severity === 'amber' && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{flag.message}</p>
                <p className="mt-1 text-xs text-amber-700">
                  {sector} is a high-impact sector where value-chain (Scope 3) emissions typically dominate the
                  footprint. Under ISSB S2 and CSRD/ESRS E1, disclosure of Scope 3 is required.
                </p>
              </div>
            </div>
          )}
          {flag.severity === 'none' && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              <Target className="h-4 w-4" /> No mandatory Scope 3 disclosure gap detected for this sector and selection.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
