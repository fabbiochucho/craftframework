// CRAFT Capacity Assessment: run an assessment, see the dashboard, radar and growth levels, build the improvement
// plan, capture the SWOT debrief, and read the yearly, mid-term and five-year reports. Scoring rules live in
// src/lib/cca/engine.ts; the server stores only the responses.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Tabs } from '../components/ui'
import { useWorkspace } from '../lib/context'
import { cn } from '../lib/utils'
import {
  availableReports, awardReadiness, cascade, dashboard, domainScore, improvementPlan, READINESS_LABEL, resolveVotes, swotSeed,
  type CcaModule, type PlanEntry, type Responses, type Score, type Swot,
} from '../lib/cca/engine'
import { CCA_MODULES, isAwardModule } from '../lib/cca/modules'

type Assessment = {
  id: string; orgId: string; module: string; year: number; awardRef: string; status: 'draft' | 'complete'; assessor: string; orgLead: string
  responses: Responses; votes: Record<string, number[]>; swot: Partial<Swot>; plan: PlanEntry[]; completedAt: string | null
}

async function api<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/cca${path}`, init && { method: init.method, headers: { 'content-type': 'application/json' }, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const body = await res.json().catch(() => ({})) as T & { error?: string }
  if (!res.ok) throw new Error(body.error === 'mfa_required' ? 'Confirm your two-step sign-in, then try again.' : body.error ?? `Request failed (${res.status})`)
  return body
}

const LEVEL_STYLE: Record<string, string> = { Nascent: 'bg-rose-100 text-rose-800', Emerging: 'bg-amber-100 text-amber-800', Expanding: 'bg-sky-100 text-sky-800', Mature: 'bg-emerald-100 text-emerald-800' }

export function CapacityAssessmentPage() {
  const { currentOrg } = useWorkspace()
  const [modules, setModules] = useState<CcaModule[] | null>(null)
  const [list, setList] = useState<Assessment[]>([])
  const [moduleId, setModuleId] = useState<string>('community')
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const orgId = currentOrg?.id ?? ''

  const load = useCallback(async () => {
    if (!orgId) return
    try { setList((await api<{ assessments: Assessment[] }>(`?orgId=${encodeURIComponent(orgId)}`)).assessments); setError(null) } catch (e) { setError((e as Error).message) }
  }, [orgId])
  useEffect(() => { api<{ modules: CcaModule[] }>('/modules').then((b) => setModules(b.modules)).catch((e) => setError((e as Error).message)) }, [])
  useEffect(() => { void load() }, [load])

  const mod = modules?.find((m) => m.id === moduleId)
  const mine = list.filter((a) => a.module === moduleId)
  const open = list.find((a) => a.id === openId) ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-emerald-900">Capacity Assessment</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Score each domain from 1 to 4. A level counts only when every statement in it, and in the levels below, is met and backed by evidence you have seen. The results show your growth level, an improvement plan for the next 12 months, and your progress over five years.</p>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {CCA_MODULES.map((m) => (
          <button key={m.id} type="button" onClick={() => { setModuleId(m.id); setOpenId(null) }}
            className={cn('rounded-full border px-3 py-1 text-xs font-semibold', moduleId === m.id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300', !modules?.some((x) => x.id === m.id) && 'opacity-50')}
            title={m.audience}>{m.name}</button>
        ))}
      </div>
      {!modules ? <p className="text-sm text-slate-500">{error ? '' : 'Loading…'}</p>
        : !mod ? <Card><CardContent className="py-8 text-sm text-slate-600">The {CCA_MODULES.find((m) => m.id === moduleId)?.name} module is being prepared and will be available soon.</CardContent></Card>
        : open ? <AssessmentView key={open.id} a={open} mod={mod} history={mine} onBack={() => setOpenId(null)} onChanged={load} />
        : <ModuleHome mod={mod} items={mine} orgId={orgId} onOpen={setOpenId} onCreated={async (id) => { await load(); setOpenId(id) }} />}
    </div>
  )
}

function ModuleHome({ mod, items, orgId, onOpen, onCreated }: { mod: CcaModule; items: Assessment[]; orgId: string; onOpen: (id: string) => void; onCreated: (id: string) => void }) {
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [award, setAward] = useState('')
  const [error, setError] = useState<string | null>(null)
  const award_ = isAwardModule(mod.id)
  const start = async () => {
    try { onCreated((await api<{ id: string }>('', { method: 'POST', body: { orgId, module: mod.id, year: Number(year), ...(award_ ? { awardRef: award } : {}) } })).id) } catch (e) { setError((e as Error).message) }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>{mod.name}</CardTitle><p className="text-sm text-slate-500">{mod.audience}</p></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            {award_ && <Input label="Grant or contract" placeholder="e.g. Health systems grant 2026" value={award} onChange={(e) => setAward(e.target.value)} />}
          </div>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <Button onClick={start} disabled={!orgId || (award_ && !award.trim())}>Start assessment</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Assessments</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {items.map((a) => {
                const d = dashboard(mod, a.responses)
                return (
                  <li key={a.id}><button type="button" onClick={() => onOpen(a.id)} className="flex w-full items-center justify-between py-2 text-left text-sm hover:text-emerald-700">
                    <span>{a.year}{a.awardRef && ` · ${a.awardRef}`} · {a.status === 'complete' ? 'Complete' : 'Draft'}</span>
                    <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', LEVEL_STYLE[d.level])}>{d.average.toFixed(2)} {d.level}</span>
                  </button></li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AssessmentView({ a, mod, history, onBack, onChanged }: { a: Assessment; mod: CcaModule; history: Assessment[]; onBack: () => void; onChanged: () => void }) {
  const [responses, setResponses] = useState<Responses>(a.responses)
  const [votes, setVotes] = useState<Record<string, number[]>>(a.votes)
  const [plan, setPlan] = useState<PlanEntry[]>(a.plan)
  const [swot, setSwot] = useState<Swot>(() => {
    const seed = swotSeed(dashboard(mod, a.responses))
    return { strengths: a.swot.strengths ?? seed.strengths, weaknesses: a.swot.weaknesses ?? seed.weaknesses, opportunities: a.swot.opportunities ?? [], threats: a.swot.threats ?? [] }
  })
  const [meta, setMeta] = useState({ assessor: a.assessor, orgLead: a.orgLead })
  const [tab, setTab] = useState('assess')
  const [message, setMessage] = useState<string | null>(null)
  const locked = a.status === 'complete'
  const d = useMemo(() => dashboard(mod, responses), [mod, responses])

  const save = async (extra: Record<string, unknown> = {}) => {
    try { await api(`/${a.id}`, { method: 'PUT', body: { responses, votes, plan, swot, ...meta, ...extra } }); setMessage('Saved.'); onChanged() } catch (e) { setMessage((e as Error).message) }
  }
  const complete = async () => {
    await save()
    try { await api(`/${a.id}/complete`, { method: 'POST' }); setMessage('Assessment completed.'); onChanged() } catch (e) { setMessage((e as Error).message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>← All assessments</Button>
        <h2 className="font-display text-lg font-bold text-emerald-900">{mod.name} · {a.year}{a.awardRef && ` · ${a.awardRef}`}</h2>
        <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', LEVEL_STYLE[d.level])}>Overall {d.average.toFixed(2)} · {d.level}</span>
        {!locked && <div className="ml-auto flex gap-2"><Button size="sm" variant="outline" onClick={() => void save()}>Save</Button><Button size="sm" onClick={() => void complete()}>Complete assessment</Button></div>}
      </div>
      {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
      <Tabs tabs={[{ id: 'assess', label: 'Assess' }, { id: 'dashboard', label: 'Dashboard' }, { id: 'plan', label: 'Improvement plan' }, { id: 'swot', label: 'SWOT debrief' }, { id: 'reports', label: 'Reports' }]} active={tab} onChange={setTab} />

      {tab === 'assess' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Assessor" value={meta.assessor} disabled={locked} onChange={(e) => setMeta({ ...meta, assessor: e.target.value })} />
            <Input label="Organisation lead" value={meta.orgLead} disabled={locked} onChange={(e) => setMeta({ ...meta, orgLead: e.target.value })} />
          </div>
          {mod.areas.map((area) => (
            <Card key={area.id}>
              <CardHeader><CardTitle>{area.name}</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {area.domains.map((dom) => {
                  const score = domainScore(dom, responses)
                  const v = (votes[dom.id] ?? []) as Score[]
                  return (
                    <div key={dom.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{dom.name}</p>
                        {dom.critical && <span className="rounded bg-rose-50 px-1.5 text-xs text-rose-700">Critical</span>}
                        <span className="ml-auto rounded bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-800">Score {score}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500"><b>Level 1:</b> {dom.level1}</p>
                      {([2, 3, 4] as const).map((l) => (
                        <fieldset key={l} className={cn('mt-2 rounded border p-2', score >= l ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-100')}>
                          <legend className="px-1 text-xs font-semibold text-slate-600">Level {l}: all must be met with evidence seen</legend>
                          {dom.levels[l].map((s) => {
                            const r = responses[s.id] ?? { met: false, evidence: '' }
                            return (
                              <div key={s.id} className="grid gap-2 py-1 sm:grid-cols-[1fr_16rem] sm:items-center">
                                <label className="flex items-start gap-2 text-sm text-slate-800">
                                  <input type="checkbox" className="mt-1" checked={r.met} disabled={locked} onChange={() => setResponses({ ...responses, [s.id]: { ...r, met: !r.met } })} />
                                  {s.text}
                                </label>
                                <input aria-label={`Evidence seen for: ${s.text}`} placeholder="Evidence seen (document, date)" value={r.evidence} disabled={locked}
                                  className={cn('rounded border px-2 py-1 text-xs', r.met && !r.evidence.trim() ? 'border-amber-400' : 'border-slate-300')}
                                  onChange={(e) => setResponses({ ...responses, [s.id]: { ...r, evidence: e.target.value } })} />
                              </div>
                            )
                          })}
                        </fieldset>
                      ))}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span>Facilitated votes (anonymous, 1–4):</span>
                        <input className="w-40 rounded border border-slate-300 px-2 py-1" placeholder="e.g. 3, 4, 3, 2" disabled={locked} defaultValue={v.join(', ')}
                          onBlur={(e) => setVotes({ ...votes, [dom.id]: e.target.value.split(/[ ,]+/).map(Number).filter((n) => n >= 1 && n <= 4) })} />
                        {v.length > 0 && <span>Highest vote the evidence supports: <b>{resolveVotes(v, score)}</b></span>}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === 'dashboard' && <DashboardView d={d} mod={mod} responses={responses} />}

      {tab === 'plan' && <PlanView mod={mod} responses={responses} plan={plan} setPlan={setPlan} locked={locked} onSave={() => void save()} />}

      {tab === 'swot' && (
        <div className="grid gap-4 md:grid-cols-2">
          {(['strengths', 'weaknesses', 'opportunities', 'threats'] as const).map((k) => (
            <label key={k} className="block text-sm font-medium capitalize text-slate-700">{k}
              <textarea rows={5} disabled={locked} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" value={swot[k].join('\n')}
                onChange={(e) => setSwot({ ...swot, [k]: e.target.value.split('\n') })} />
            </label>
          ))}
        </div>
      )}

      {tab === 'reports' && <ReportsView mod={mod} history={history} />}
    </div>
  )
}

function DashboardView({ d, mod, responses }: { d: ReturnType<typeof dashboard>; mod: CcaModule; responses: Responses }) {
  const readiness = isAwardModule(mod.id) ? awardReadiness(mod, responses) : null
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Dashboard</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Capacity area</th><th>Total</th><th>Average</th><th>Growth level</th></tr></thead>
            <tbody>
              {d.areas.map((a) => (
                <tr key={a.id} className="border-t border-slate-100"><td className="py-1.5">{a.name}</td><td>{a.total}</td><td>{a.average.toFixed(2)}</td><td><span className={cn('rounded px-2 py-0.5 text-xs font-semibold', LEVEL_STYLE[a.level])}>{a.level}</span></td></tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold"><td className="py-1.5">Overall</td><td>{d.total}</td><td>{d.average.toFixed(2)}</td><td><span className={cn('rounded px-2 py-0.5 text-xs', LEVEL_STYLE[d.level])}>{d.level}</span></td></tr>
            </tbody>
          </table>
          {readiness && (
            <div className="mt-4 rounded-lg border border-slate-200 p-3 text-sm">
              <p className="font-semibold">Award readiness: {READINESS_LABEL[readiness.rating]}</p>
              {readiness.conditions.length > 0 && <ul className="mt-1 list-disc pl-5 text-slate-700">{readiness.conditions.map((c) => <li key={c.domainId}>{c.domain} (score {c.score}): {c.actions.join('; ') || 'review'}</li>)}</ul>}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Radar</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={d.areas.map((a) => ({ area: a.name, average: a.average }))}>
              <PolarGrid /><PolarAngleAxis dataKey="area" tick={{ fontSize: 11 }} /><PolarRadiusAxis domain={[0, 4]} tickCount={5} />
              <Radar dataKey="average" stroke="#059669" fill="#10b981" fillOpacity={0.35} /><Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

function PlanView({ mod, responses, plan, setPlan, locked, onSave }: { mod: CcaModule; responses: Responses; plan: PlanEntry[]; setPlan: (p: PlanEntry[]) => void; locked: boolean; onSave: () => void }) {
  const p = improvementPlan(mod, responses, plan)
  const upd = (domainId: string, patch: Partial<PlanEntry>) => {
    const cur = plan.find((e) => e.domainId === domainId) ?? { domainId }
    setPlan([...plan.filter((e) => e.domainId !== domainId), { ...cur, ...patch }])
  }
  return (
    <Card>
      <CardHeader><CardTitle>Improvement plan (next 12 months)</CardTitle><p className="text-sm text-slate-500">Each domain below 4 aims one level up. The actions are the statements not yet met; add the timeline, cost and who is responsible.</p></CardHeader>
      <CardContent className="space-y-3">
        {p.rows.length === 0 ? <p className="text-sm text-slate-500">Every domain is at 4. Keep the evidence current.</p> : p.rows.map((r) => (
          <div key={r.domainId} className="rounded-lg border border-slate-200 p-3 text-sm">
            <p className="font-medium">{r.domain}: {r.current} → <b>{r.envisioned}</b></p>
            <ul className="mt-1 list-disc pl-5 text-slate-700">{r.actions.map((x) => <li key={x}>{x}</li>)}</ul>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <Input label="Timeline" value={r.timeline} disabled={locked} onChange={(e) => upd(r.domainId, { timeline: e.target.value })} />
              <Input label="Cost" type="number" min={0} value={r.cost || ''} disabled={locked} onChange={(e) => upd(r.domainId, { costs: Number(e.target.value) || 0 })} />
              <Input label="Responsible" value={r.responsible} disabled={locked} onChange={(e) => upd(r.domainId, { responsible: e.target.value })} />
            </div>
          </div>
        ))}
        <p className="text-sm font-semibold">Total cost: {p.totalCost.toLocaleString()}</p>
        {!locked && <Button size="sm" variant="outline" onClick={onSave}>Save plan</Button>}
      </CardContent>
    </Card>
  )
}

function ReportsView({ mod, history }: { mod: CcaModule; history: Assessment[] }) {
  const records = history.filter((a) => a.status === 'complete' && !a.awardRef).map((a) => ({ year: a.year, dashboard: dashboard(mod, a.responses) }))
  const kinds = availableReports(records)
  const [kind, setKind] = useState<string>('yearly')
  const c = cascade(records)
  const years = [...new Set(records.map((r) => r.year))].sort()
  const data = years.map((y) => Object.fromEntries([['year', y], ...c.map((a) => [a.name, a.series.find((s) => s.year === y)?.average ?? null])]))
  const COLORS = ['#059669', '#0284c7', '#d97706', '#7c3aed', '#dc2626', '#0d9488', '#4f46e5', '#ca8a04']
  return (
    <Card>
      <CardHeader><CardTitle>Reports</CardTitle><p className="text-sm text-slate-500">Yearly needs one completed assessment; mid-term three consecutive years; five-year five consecutive years.</p></CardHeader>
      <CardContent className="space-y-3">
        <div className="w-60"><Select label="Report" value={kind} onChange={setKind} options={[{ value: 'yearly', label: 'Yearly' }, { value: 'mid_term', label: 'Mid-term' }, { value: 'five_year', label: 'Five-year' }]} /></div>
        {!kinds.includes(kind as never) ? <p className="text-sm text-slate-500">Not available yet: complete more yearly assessments.</p> : (
          <>
            <ul className="text-sm">{c.map((a) => <li key={a.areaId}>{a.name}: {a.series.map((s) => `${s.year} ${s.average.toFixed(2)}`).join(' → ')} (<b>{a.trend}</b>)</li>)}</ul>
            {kind !== 'yearly' && (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="year" /><YAxis domain={[1, 4]} /><Tooltip /><Legend />
                    {c.map((a, i) => <Line key={a.areaId} type="monotone" dataKey={a.name} stroke={COLORS[i % COLORS.length]} />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
