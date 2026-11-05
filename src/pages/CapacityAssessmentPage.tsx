// CRAFT Capacity Assessment: run an assessment, see the dashboard, radar and growth levels, build the improvement
// plan, capture the SWOT debrief, and read the yearly, mid-term and five-year reports. Scoring rules live in
// src/lib/cca/engine.ts; the server stores only the responses.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Tabs } from '../components/ui'
import { useWorkspace } from '../lib/context'
import { cn } from '../lib/utils'
import {
  availableReports, awardReadiness, cascade, COST_LINES, dashboard, effectiveNotAssessed, domainScore, improvementPlan, READINESS_LABEL, resolveVotes, swotSeed,
  type CcaModule, type CostLines, type NotAssessed, type PlanEntry, type Responses, type Score, type Swot,
} from '../lib/cca/engine'
import { CCA_MODULES, isAwardModule, isGovernmentModule, placeLabel } from '../lib/cca/modules'
import { ScreeningCard } from '../components/ScreeningCard'
import { QuickScreenCard } from '../components/QuickScreenCard'
import { DeskReviewPanel, deskRequirements, useDeskReview } from '../components/DeskReviewPanel'
import { documentsForDomain, STATUS_META } from '../lib/dataroom'

type Assessment = {
  id: string; orgId: string; module: string; year: number; awardRef: string; region: string; district: string; status: 'draft' | 'complete'; assessor: string; orgLead: string
  responses: Responses; notAssessed: NotAssessed; domainIds: string[] | null; votes: Record<string, number[]>; swot: Partial<Swot>; plan: PlanEntry[]; completedAt: string | null
}

async function api<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/cca${path}`, init && { method: init.method, headers: { 'content-type': 'application/json' }, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const body = await res.json().catch(() => ({})) as T & { error?: string }
  if (!res.ok) throw new Error(body.error === 'mfa_required' ? 'Confirm your two-step sign-in, then try again.' : body.error ?? `Request failed (${res.status})`)
  return body
}

const LEVEL_STYLE: Record<string, string> = { Nascent: 'bg-rose-100 text-rose-800', Emerging: 'bg-amber-100 text-amber-800', Expanding: 'bg-sky-100 text-sky-800', Mature: 'bg-emerald-100 text-emerald-800', 'Not assessed': 'bg-slate-100 text-slate-600' }
/** What to leave out when scoring a stored assessment (skipped domains, and domains added after completion). */
const skips = (mod: CcaModule, a: Assessment) => effectiveNotAssessed(mod, a.notAssessed ?? {}, a.domainIds)
const fmt = (x: { average: number; percent: number }) => `${x.average.toFixed(2)} · ${x.percent}%`

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
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Score each domain from 1 to 4. A level counts only when every statement in it, and in the levels below, is met and backed by evidence you have seen. Each capacity area counts equally in the overall score, read as a growth level: Nascent up to 25% of the maximum, Emerging up to 50%, Expanding up to 75%, Mature above. The results show an improvement plan for the next 12 months, and your progress over five years.</p>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {CCA_MODULES.map((m) => (
          <button key={m.id} type="button" onClick={() => { setModuleId(m.id); setOpenId(null) }}
            className={cn('rounded-full border px-3 py-1 text-xs font-semibold', moduleId === m.id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300', !modules?.some((x) => x.id === m.id) && 'opacity-50')}
            title={m.audience}>{m.name}</button>
        ))}
        <button type="button" onClick={() => { setModuleId('desk'); setOpenId(null) }}
          className={cn('rounded-full border px-3 py-1 text-xs font-semibold', moduleId === 'desk' ? 'border-sky-700 bg-sky-700 text-white' : 'border-sky-200 bg-white text-sky-800 hover:border-sky-400')}
          title="Documents, custodians, due dates and the fieldwork log">Desk review</button>
      </div>
      {moduleId === 'desk' ? (orgId ? <DeskReviewPanel orgId={orgId} modules={modules ?? []} /> : null)
        : !modules ? <p className="text-sm text-slate-500">{error ? '' : 'Loading…'}</p>
        : !mod ? <Card><CardContent className="py-8 text-sm text-slate-600">The {CCA_MODULES.find((m) => m.id === moduleId)?.name} module is being prepared and will be available soon.</CardContent></Card>
        : open ? <AssessmentView key={open.id} a={open} mod={mod} history={mine.filter((x) => placeLabel(x) === placeLabel(open))} onBack={() => setOpenId(null)} onChanged={load} />
        : <ModuleHome mod={mod} items={mine} orgId={orgId} onOpen={setOpenId} onCreated={async (id) => { await load(); setOpenId(id) }} />}
    </div>
  )
}

function ModuleHome({ mod, items, orgId, onOpen, onCreated }: { mod: CcaModule; items: Assessment[]; orgId: string; onOpen: (id: string) => void; onCreated: (id: string) => void }) {
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [award, setAward] = useState('')
  const [place, setPlace] = useState({ region: '', district: '' })
  const gov = isGovernmentModule(mod.id)
  const [error, setError] = useState<string | null>(null)
  const [awards, setAwards] = useState<{ id: string; title: string }[]>([])
  const award_ = isAwardModule(mod.id)
  useEffect(() => {
    if (award_ && orgId) fetch(`/api/awards?orgId=${encodeURIComponent(orgId)}`).then((r) => (r.ok ? r.json() : { awards: [] })).then((b) => setAwards(b.awards ?? [])).catch(() => setAwards([]))
  }, [award_, orgId])
  const awardTitle = (ref: string) => awards.find((a) => a.id === ref)?.title ?? ref
  const start = async () => {
    try { onCreated((await api<{ id: string }>('', { method: 'POST', body: { orgId, module: mod.id, year: Number(year), ...(award_ ? { awardRef: award } : {}), ...(gov ? place : {}) } })).id) } catch (e) { setError((e as Error).message) }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>{mod.name}</CardTitle><p className="text-sm text-slate-500">{mod.audience}</p></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            {award_ && (awards.length
              ? <Select label="Grant or contract" placeholder="Choose an award" value={award} onChange={setAward} options={awards.map((a) => ({ value: a.id, label: a.title }))} />
              : <p className="self-end text-sm text-slate-600">Add the grant or contract in <Link to="/awards" className="text-emerald-700 underline">Awards &amp; Issues</Link> first.</p>)}
            {gov && <>
              <Input label="State or region (optional)" value={place.region} onChange={(e) => setPlace({ ...place, region: e.target.value })} />
              <Input label="District or local government area (optional)" value={place.district} onChange={(e) => setPlace({ ...place, district: e.target.value })} />
            </>}
          </div>
          {gov && <p className="text-xs text-slate-500">Leave both empty to assess the whole body. Name a place to assess an office or area within it; results can then be compared by place.</p>}
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
                const d = dashboard(mod, a.responses, skips(mod, a))
                return (
                  <li key={a.id}><button type="button" onClick={() => onOpen(a.id)} className="flex w-full items-center justify-between py-2 text-left text-sm hover:text-emerald-700">
                    <span>{a.year}{a.awardRef && ` · ${awardTitle(a.awardRef)}`}{placeLabel(a) && ` · ${placeLabel(a)}`} · {a.status === 'complete' ? 'Complete' : 'Draft'}</span>
                    <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', LEVEL_STYLE[d.level])}>{fmt(d)} {d.level}</span>
                  </button></li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      {gov && <ByPlace mod={mod} items={items} />}
      {mod.id === 'pre_award' && <QuickScreenCard orgId={orgId} awards={awards} />}
    </div>
  )
}

/** The latest completed assessment for each place, side by side, when a body has assessed more than one place. */
function ByPlace({ mod, items }: { mod: CcaModule; items: Assessment[] }) {
  const latest = new Map<string, Assessment>()
  for (const a of items.filter((x) => x.status === 'complete').sort((x, y) => x.year - y.year)) latest.set(placeLabel(a), a)
  if (latest.size < 2) return null
  const rows = [...latest.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([place, a]) => ({ place, a, d: dashboard(mod, a.responses, skips(mod, a)) }))
  return (
    <Card className="lg:col-span-2">
      <CardHeader><CardTitle>By place</CardTitle><p className="text-sm text-slate-500">The latest completed assessment for each place.</p></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Place</th><th>Year</th>{mod.areas.map((x) => <th key={x.id} className="px-1">{x.name}</th>)}<th>Overall</th></tr></thead>
          <tbody>{rows.map(({ place, a, d }) => (
            <tr key={place} className="border-t border-slate-100">
              <td className="py-1.5">{place || 'Whole body'}</td><td>{a.year}</td>
              {d.areas.map((x) => <td key={x.id} className="px-1 tabular-nums">{x.level === 'Not assessed' ? '–' : `${x.percent}%`}</td>)}
              <td><span className={cn('rounded px-2 py-0.5 text-xs font-semibold', LEVEL_STYLE[d.level])}>{fmt(d)} {d.level}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function AssessmentView({ a, mod, history, onBack, onChanged }: { a: Assessment; mod: CcaModule; history: Assessment[]; onBack: () => void; onChanged: () => void }) {
  const currentOrgName = useWorkspace().currentOrg?.name ?? ''
  const [responses, setResponses] = useState<Responses>(a.responses)
  const [notAssessed, setNotAssessed] = useState<NotAssessed>(() => skips(mod, a))
  const [votes, setVotes] = useState<Record<string, number[]>>(a.votes)
  const [plan, setPlan] = useState<PlanEntry[]>(a.plan)
  const [swot, setSwot] = useState<Swot>(() => {
    const seed = swotSeed(dashboard(mod, a.responses, skips(mod, a)))
    return { strengths: a.swot.strengths ?? seed.strengths, weaknesses: a.swot.weaknesses ?? seed.weaknesses, opportunities: a.swot.opportunities ?? [], threats: a.swot.threats ?? [] }
  })
  const [meta, setMeta] = useState({ assessor: a.assessor, orgLead: a.orgLead })
  const [tab, setTab] = useState('assess')
  const [message, setMessage] = useState<string | null>(null)
  const locked = a.status === 'complete'
  const d = useMemo(() => dashboard(mod, responses, notAssessed), [mod, responses, notAssessed])
  // Desk review documents behind each domain, so the evidence already gathered is in front of the assessor.
  const desk = useDeskReview(a.orgId)
  const deskReqs = useMemo(() => deskRequirements(desk.data?.profile ?? null), [desk.data])
  const deskStatus = (id: string) => desk.data?.items.find((i) => i.requirementId === id)?.status ?? 'missing'
  const canSkip = !isAwardModule(mod.id)

  const save = async (extra: Record<string, unknown> = {}) => {
    try { await api(`/${a.id}`, { method: 'PUT', body: { responses, votes, plan, swot, ...(canSkip ? { notAssessed } : {}), ...meta, ...extra } }); setMessage('Saved.'); onChanged() } catch (e) { setMessage((e as Error).message) }
  }
  const complete = async () => {
    await save()
    try { await api(`/${a.id}/complete`, { method: 'POST' }); setMessage('Assessment completed.'); onChanged() } catch (e) { setMessage((e as Error).message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>← All assessments</Button>
        <h2 className="font-display text-lg font-bold text-emerald-900">{mod.name} · {a.year}{a.awardRef && ` · ${a.awardRef}`}{placeLabel(a) && ` · ${placeLabel(a)}`}</h2>
        <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', LEVEL_STYLE[d.level])}>Overall {fmt(d)} · {d.level}</span>
        {!locked && <div className="ml-auto flex gap-2"><Button size="sm" variant="outline" onClick={() => void save()}>Save</Button><Button size="sm" onClick={() => void complete()}>Complete assessment</Button></div>}
      </div>
      {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
      <Tabs tabs={[{ id: 'assess', label: 'Assess' }, { id: 'dashboard', label: 'Dashboard' }, { id: 'plan', label: 'Improvement plan' }, { id: 'swot', label: 'SWOT debrief' }, { id: 'reports', label: 'Reports' }, ...(mod.id === 'pre_award' ? [{ id: 'screening', label: 'Screening' }] : [])]} active={tab} onChange={setTab} />

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
                  const skipped = notAssessed[dom.id] !== undefined
                  const toggleSkip = () => {
                    const { [dom.id]: _, ...rest } = notAssessed
                    setNotAssessed(skipped ? rest : { ...notAssessed, [dom.id]: '' })
                  }
                  return (
                    <div key={dom.id} className={cn('rounded-lg border border-slate-200 p-3', skipped && 'bg-slate-50')}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{dom.name}</p>
                        {dom.critical && <span className="rounded bg-rose-50 px-1.5 text-xs text-rose-700">Critical</span>}
                        {canSkip && <label className="ml-auto flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={skipped} disabled={locked} onChange={toggleSkip} />Not assessed</label>}
                        <span className={cn('rounded px-2 py-0.5 text-sm font-semibold', skipped ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-800', !canSkip && 'ml-auto')}>{skipped ? 'Not assessed' : `Score ${score}`}</span>
                      </div>
                      {skipped && (
                        <input aria-label={`Why ${dom.name} is not assessed`} placeholder="Why it is not assessed (left out of the averages)" value={notAssessed[dom.id]} disabled={locked}
                          className={cn('mt-2 w-full rounded border px-2 py-1 text-xs', notAssessed[dom.id].trim().length < 3 ? 'border-amber-400' : 'border-slate-300')}
                          onChange={(e) => setNotAssessed({ ...notAssessed, [dom.id]: e.target.value })} />
                      )}
                      <p className="mt-1 text-xs text-slate-500"><b>Level 1:</b> {dom.level1}</p>
                      {documentsForDomain(deskReqs, mod.id, dom.id).length > 0 && (
                        <p className="mt-1 text-xs text-slate-600">Desk review: {documentsForDomain(deskReqs, mod.id, dom.id).map((r) => `${r.documentName} (${STATUS_META[deskStatus(r.id)].label.toLowerCase()})`).join(' · ')}</p>
                      )}
                      {!skipped && ([2, 3, 4] as const).map((l) => (
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
                      {!skipped && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span>Facilitated votes (anonymous, 1–4):</span>
                        <input className="w-40 rounded border border-slate-300 px-2 py-1" placeholder="e.g. 3, 4, 3, 2" disabled={locked} defaultValue={v.join(', ')}
                          onBlur={(e) => setVotes({ ...votes, [dom.id]: e.target.value.split(/[ ,]+/).map(Number).filter((n) => n >= 1 && n <= 4) })} />
                        {v.length > 0 && <span>Highest vote the evidence supports: <b>{resolveVotes(v, score)}</b></span>}
                      </div>}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === 'dashboard' && <DashboardView d={d} mod={mod} responses={responses} />}

      {tab === 'plan' && <PlanView mod={mod} responses={responses} notAssessed={notAssessed} plan={plan} setPlan={setPlan} locked={locked} onSave={() => void save()} />}

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

      {tab === 'screening' && <ScreeningCard orgId={a.orgId} orgName={currentOrgName} awardId={a.awardRef || undefined} />}
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
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Capacity area</th><th>Total</th><th>Average · % of max</th><th>Growth level</th></tr></thead>
            <tbody>
              {d.areas.map((a) => (
                <tr key={a.id} className="border-t border-slate-100"><td className="py-1.5">{a.name}</td><td>{a.total}</td><td>{a.level === 'Not assessed' ? '–' : fmt(a)}</td><td><span className={cn('rounded px-2 py-0.5 text-xs font-semibold', LEVEL_STYLE[a.level])}>{a.level}</span></td></tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold"><td className="py-1.5">Overall</td><td>{d.total}</td><td>{fmt(d)}</td><td><span className={cn('rounded px-2 py-0.5 text-xs', LEVEL_STYLE[d.level])}>{d.level}</span></td></tr>
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

function PlanView({ mod, responses, notAssessed, plan, setPlan, locked, onSave }: { mod: CcaModule; responses: Responses; notAssessed: NotAssessed; plan: PlanEntry[]; setPlan: (p: PlanEntry[]) => void; locked: boolean; onSave: () => void }) {
  const p = improvementPlan(mod, responses, plan, notAssessed)
  const upd = (domainId: string, patch: Partial<PlanEntry>) => {
    const cur = plan.find((e) => e.domainId === domainId) ?? { domainId }
    setPlan([...plan.filter((e) => e.domainId !== domainId), { ...cur, ...patch }])
  }
  // A plan saved with a single cost figure starts its lines from that figure as technical assistance.
  const lineOf = (domainId: string): CostLines => {
    const e = plan.find((x) => x.domainId === domainId)
    return e?.lines ?? (e?.costs ? { technicalAssistance: e.costs } : {})
  }
  const setLine = (domainId: string, patch: CostLines) => upd(domainId, { lines: { ...lineOf(domainId), ...patch }, costs: undefined })
  return (
    <Card>
      <CardHeader><CardTitle>Improvement plan (next 12 months)</CardTitle><p className="text-sm text-slate-500">Each domain below 4 aims one level up. The actions are the statements not yet met; add the timeline, who is responsible and the costs by kind.</p></CardHeader>
      <CardContent className="space-y-3">
        {p.rows.length === 0 ? <p className="text-sm text-slate-500">Every domain is at 4. Keep the evidence current.</p> : p.rows.map((r) => (
          <div key={r.domainId} className="rounded-lg border border-slate-200 p-3 text-sm">
            <p className="font-medium">{r.domain}: {r.current} → <b>{r.envisioned}</b></p>
            <ul className="mt-1 list-disc pl-5 text-slate-700">{r.actions.map((x) => <li key={x}>{x}</li>)}</ul>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Input label="Timeline (e.g. weeks 2–6, June)" value={r.timeline} disabled={locked} onChange={(e) => upd(r.domainId, { timeline: e.target.value })} />
              <Input label="Responsible (by role)" value={r.responsible} disabled={locked} onChange={(e) => upd(r.domainId, { responsible: e.target.value })} />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {COST_LINES.map((c) => (
                <Input key={c.id} label={c.label} type="number" min={0} value={lineOf(r.domainId)[c.id] || ''} disabled={locked}
                  onChange={(e) => setLine(r.domainId, { [c.id]: Number(e.target.value) || 0 })} />
              ))}
              <Input label="Participants" type="number" min={0} value={lineOf(r.domainId).participants || ''} disabled={locked}
                onChange={(e) => setLine(r.domainId, { participants: Math.floor(Number(e.target.value)) || 0 })} />
            </div>
            <p className="mt-1 text-right text-xs text-slate-600">Domain total: <b>{r.cost.toLocaleString()}</b></p>
          </div>
        ))}
        {p.toAssess.length > 0 && <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm"><p className="font-medium">Yet to be assessed: assess these next time</p><ul className="mt-1 list-disc pl-5 text-slate-700">{p.toAssess.map((x) => <li key={x.domainId}>{x.domain}{x.reason && ` (${x.reason})`}</li>)}</ul></div>}
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-semibold">Total cost of capacity improvement: {p.totalCost.toLocaleString()}</p>
          <ul className="mt-1 grid gap-x-6 text-slate-700 sm:grid-cols-2">
            {COST_LINES.map((c) => <li key={c.id}>{c.label === 'Training, per participant' ? 'Training' : c.label}: {p.byLine[c.id].toLocaleString()}</li>)}
            {mod.areas.filter((a) => p.byArea[a.id]).map((a) => <li key={a.id}>{a.name}: {p.byArea[a.id].toLocaleString()}</li>)}
          </ul>
        </div>
        {!locked && <Button size="sm" variant="outline" onClick={onSave}>Save plan</Button>}
      </CardContent>
    </Card>
  )
}

function ReportsView({ mod, history }: { mod: CcaModule; history: Assessment[] }) {
  const records = history.filter((a) => a.status === 'complete' && !a.awardRef).map((a) => ({ year: a.year, dashboard: dashboard(mod, a.responses, skips(mod, a)) }))
  const latest = [...records].sort((x, y) => y.year - x.year)[0]
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
            {latest && <p className="text-sm">Current assessment year <b>{latest.year}</b> · current rating <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', LEVEL_STYLE[latest.dashboard.level])}>{latest.dashboard.level}</span> ({fmt(latest.dashboard)})</p>}
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
