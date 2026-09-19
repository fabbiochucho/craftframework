import { useMemo, useState } from 'react'
import {
  Globe, Scale, Landmark, ShieldCheck, AlertOctagon, ChevronRight, ChevronDown,
  BadgeCheck, Coins, Users, FileCheck2, Building2, TrendingUp,
} from 'lucide-react'
import {
  Card, CardContent, Badge, Input, Select,
} from '../components/ui'
import { cn } from '../lib/utils'
import {
  REGULATORY_PILLARS, JurisdictionId, SectorArchetype, SECTOR_LABEL,
  resolveRegulatoryContext, evaluatePrudential, PrudentialInputs, PrudentialFinding,
  ACCOUNTING_STANDARDS, AccountingStandard, SOX_CHECKLIST,
  SHARIA_PRINCIPLES, ISLAMIC_INSTRUMENTS, INFORMAL_ROCA_DIMENSIONS,
  PRIORITY_RANK, StatutoryRequirement,
} from '../lib/regulatory-context'

// ============================================================================
// FEATURE 1 + 3 + 4 - The Jurisdictional Context Engine surface.
// A multi-select jurisdiction picker + sector archetype dynamically injects the
// exact statutory checklists, the Basel prudential tracker, the SOX ICFR
// checklist, the accounting-standards toggle, and the Islamic-finance / informal
// modules. Everything below reacts to the selection with zero hardcoded routing.
// ============================================================================

const priorityStyle: Record<StatutoryRequirement['priority'], string> = {
  Critical: 'border-rose-200 bg-rose-50 text-rose-700',
  High: 'border-amber-200 bg-amber-50 text-amber-700',
  Moderate: 'border-slate-200 bg-slate-50 text-slate-600',
}

const prudentialTone: Record<PrudentialFinding['severity'], { badge: string; row: string; label: string }> = {
  compliant: { badge: 'bg-emerald-100 text-emerald-700', row: 'border-emerald-200', label: 'Compliant' },
  warning: { badge: 'bg-amber-100 text-amber-700', row: 'border-amber-200', label: 'Warning' },
  breach: { badge: 'bg-rose-100 text-rose-700', row: 'border-rose-300', label: 'Prudential Breach' },
  not_entered: { badge: 'bg-slate-100 text-slate-500', row: 'border-slate-200', label: 'Not entered' },
}

export function RegulatoryCompliancePage() {
  const [selected, setSelected] = useState<JurisdictionId[]>(['NG'])
  const [sector, setSector] = useState<SectorArchetype>('bank_dfi')
  const [standard, setStandard] = useState<AccountingStandard>('ifrs_full')
  const [prudential, setPrudential] = useState<PrudentialInputs>({})
  const [expanded, setExpanded] = useState<Record<JurisdictionId, boolean>>({} as Record<JurisdictionId, boolean>)

  const ctx = useMemo(() => resolveRegulatoryContext(selected, sector), [selected, sector])
  const findings = useMemo(
    () => (ctx.showPrudential ? evaluatePrudential(selected, prudential) : []),
    [ctx.showPrudential, selected, prudential],
  )

  function toggleJurisdiction(id: JurisdictionId) {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const requirementsByPillar = useMemo(() => {
    return ctx.pillars.map(p => ({
      pillar: p,
      reqs: p.requirements
        .filter(r => ctx.requirements.includes(r))
        .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]),
    }))
  }, [ctx])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
          <Globe className="h-4 w-4" /> Jurisdictional Context Engine
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">
          Global Regulatory &amp; Statutory Compliance
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Select the jurisdictions the entity operates in (or targets for capital) and its sector.
          CRAFT acts as a Regulatory Translator — dynamically injecting the exact statutory checklists,
          prudential thresholds and disclosure requirements that apply.
        </p>
      </header>

      {/* Jurisdiction multi-select + sector */}
      <Card className="mb-6">
        <CardContent className="py-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Operating &amp; target jurisdictions (multi-select)
          </p>
          <div className="flex flex-wrap gap-2">
            {REGULATORY_PILLARS.map(p => {
              const on = selected.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => toggleJurisdiction(p.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    on
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <span className="text-base">{p.flag}</span>
                  {p.name}
                  {on && <BadgeCheck className="h-4 w-4 text-emerald-600" />}
                </button>
              )
            })}
          </div>
          <div className="mt-4 max-w-xs">
            <Select
              label="Sector archetype"
              value={sector}
              onChange={v => setSector(v as SectorArchetype)}
              options={(Object.keys(SECTOR_LABEL) as SectorArchetype[]).map(s => ({ value: s, label: SECTOR_LABEL[s] }))}
            />
          </div>
        </CardContent>
      </Card>

      {selected.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Select at least one jurisdiction to inject its statutory checklist.
        </div>
      )}

      {/* Injected statutory checklists (grouped & expandable by jurisdiction) */}
      {requirementsByPillar.map(({ pillar, reqs }) => {
        const open = expanded[pillar.id] ?? true
        return (
          <Card key={pillar.id} className="mb-4">
            <button
              onClick={() => setExpanded(e => ({ ...e, [pillar.id]: !open }))}
              className="flex w-full items-center justify-between px-6 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{pillar.flag}</span>
                <div>
                  <p className="font-display text-lg font-semibold text-slate-800">{pillar.name}</p>
                  <p className="text-xs text-slate-500">{pillar.regulators.join(' · ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-slate-100 text-slate-600">{reqs.length} requirements</Badge>
                {open ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
              </div>
            </button>
            {open && (
              <CardContent className="pt-0">
                {reqs.length === 0 ? (
                  <p className="text-sm text-slate-500">No requirements triggered for the {SECTOR_LABEL[sector]} archetype.</p>
                ) : (
                  <div className="space-y-2">
                    {reqs.map(r => (
                      <div key={r.code} className={cn('rounded-lg border p-3', priorityStyle[r.priority])}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border border-current bg-white/60 font-mono text-[10px]">{r.code}</Badge>
                          <span className="text-xs font-semibold uppercase tracking-wide">{r.priority}</span>
                          <span className="text-xs text-slate-500">· {r.authority}</span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium text-slate-800">{r.requirement}</p>
                        <p className="mt-1 font-mono text-[11px] text-slate-500">{r.citation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* Statutory Readiness Tracker */}
      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Scale className="h-4 w-4" /> Statutory Readiness Tracker
        </div>

        {/* Accounting standard toggle */}
        <Card className="mb-4">
          <CardContent className="py-5">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-emerald-600" />
              <h3 className="font-semibold text-slate-800">Accounting Standard</h3>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ACCOUNTING_STANDARDS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStandard(s.id)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
                    standard === s.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Unlocked disclosure checklists
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ACCOUNTING_STANDARDS.find(s => s.id === standard)!.unlocks.map(u => (
                  <Badge key={u} className="border border-emerald-200 bg-white text-emerald-700">{u}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Basel III/IV prudential tracker */}
        {ctx.showPrudential && (
          <Card className="mb-4">
            <CardContent className="py-5">
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-slate-800">Basel III/IV Prudential Tracker</h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Evaluated against the strictest minimum across selected jurisdictions
                ({selected.filter(j => ['NG', 'ZA', 'US', 'EU', 'OHADA', 'GCC'].includes(j)).join(', ') || '—'}).
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Input
                  label="Capital Adequacy Ratio (%)" type="number"
                  value={prudential.car ?? ''}
                  onChange={e => setPrudential(p => ({ ...p, car: e.target.value === '' ? undefined : Number(e.target.value) }))}
                />
                <Input
                  label="Liquidity Coverage Ratio (%)" type="number"
                  value={prudential.lcr ?? ''}
                  onChange={e => setPrudential(p => ({ ...p, lcr: e.target.value === '' ? undefined : Number(e.target.value) }))}
                />
                <Input
                  label="Leverage Ratio (%)" type="number"
                  value={prudential.leverage ?? ''}
                  onChange={e => setPrudential(p => ({ ...p, leverage: e.target.value === '' ? undefined : Number(e.target.value) }))}
                />
              </div>
              <div className="mt-4 space-y-2">
                {findings.map(f => {
                  const tone = prudentialTone[f.severity]
                  return (
                    <div key={f.metric} className={cn('flex items-start gap-3 rounded-lg border p-3', tone.row)}>
                      {f.severity === 'breach'
                        ? <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                        : <ShieldCheck className={cn('mt-0.5 h-5 w-5 shrink-0', f.severity === 'compliant' ? 'text-emerald-600' : 'text-slate-400')} />}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{f.metric}</span>
                          <Badge className={tone.badge}>{tone.label}</Badge>
                        </div>
                        <p className={cn('mt-0.5 text-sm', f.severity === 'breach' ? 'font-semibold text-rose-700' : 'text-slate-600')}>
                          {f.message}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SOX §302/§404 */}
        {ctx.showSox && (
          <Card className="mb-4">
            <CardContent className="py-5">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-slate-800">SOX Internal Controls (US Public Companies)</h3>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SOX_CHECKLIST.map(c => (
                  <label key={c.title} className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.title}</p>
                      <p className="font-mono text-[11px] text-slate-500">§{c.section} · {c.citation}</p>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Islamic Finance module */}
        {ctx.showSharia && (
          <Card className="mb-4">
            <CardContent className="py-5">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-slate-800">Islamic Finance &amp; Sharia Compliance</h3>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sharia principles</p>
                  <ul className="mt-2 space-y-1.5">
                    {SHARIA_PRINCIPLES.map(p => (
                      <li key={p.key} className="text-sm text-slate-700">
                        <span className="font-medium">{p.name}</span>{' '}
                        <span className="font-mono text-slate-400">{p.arabic}</span>
                        <span className="block text-xs text-slate-500">{p.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Instruments &amp; governance</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ISLAMIC_INSTRUMENTS.map(i => (
                      <Badge key={i.key} className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                        {i.name}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    Requires Sharia Supervisory Board governance documentation (AAOIFI GS No. 1-6).
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Informal Economy archetype */}
        {ctx.showInformal && (
          <Card className="mb-4">
            <CardContent className="py-5">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-slate-800">Micro / Informal Economy Track</h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Mobile-first, offline-capable, vernacular-language simplified ROCA / CPI assessment for
                cooperatives, street-level distributors and unregistered collectives seeking micro-finance or DFI grants.
              </p>
              <div className="mt-3 space-y-2">
                {INFORMAL_ROCA_DIMENSIONS.map(d => (
                  <div key={d.key} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-800">{d.label}</p>
                    <p className="text-xs text-slate-500">“{d.vernacularHint}”</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <p className="mt-8 flex items-center gap-1.5 text-xs text-slate-400">
        <TrendingUp className="h-3.5 w-3.5" />
        Sustainability disclosures (ISSB S1/S2 &amp; CSRD) are handled on the dedicated ISSB Disclosures surface.
      </p>
    </div>
  )
}
