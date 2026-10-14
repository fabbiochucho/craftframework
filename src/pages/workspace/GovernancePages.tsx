import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Bar, BarChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { api, SEVERITY_STYLE, TIER_LABEL, wsPath } from '../../lib/workspaceApi'
import { ALL_DOMAINS, GOVERNANCE_DOMAINS } from '../../lib/governanceDomains'
import { Accordion, Badge, Button, Card, CardContent, Input, Select, Table, Tbody, Td, Th, Thead, Tabs } from '../../components/ui'
import { EditFields, ErrorLine, Header, State, StatusPill, useAction, useApi } from './shared'
import { activeItems, REVIEW_DOMAINS } from '../../lib/health-security'
import { catalogueByType, RESTRICTED_LABELS } from '../../lib/assessment-catalogues'

const CATALOGUE_TYPES = ['NPHI', 'JEE', 'JEE_SUB', 'SPAR', 'PSP']
function healthSecurityDomains(a: any): { value: string; label: string }[] | null {
  if (a.assessmentType === 'AAR' || a.assessmentType === 'SIMEX') return REVIEW_DOMAINS
  const cat = catalogueByType(a.assessmentType)
  return cat ? activeItems(cat, a.innovationSupport).map(i => ({ value: i.id, label: `${i.id} ${i.name}` })) : null
}

function CatalogueWizard({ workspaceId, a, reload }: { workspaceId: string; a: any; reload: () => void }) {
  const cat = catalogueByType(a.assessmentType)!
  const locked = a.status !== 'draft'
  const sections = cat.sections.filter(s => a.innovationSupport || !s.extended)
  const [section, setSection] = useState(sections[0].id)
  const [draft, setDraft] = useState<Record<string, { score: string; evidence: boolean; na: boolean; naReason: string }>>({})
  const { run, error } = useAction(reload)
  const saved = new Map<string, any>(a.scores.map((s: any) => [s.domain, s]))
  const intro = sections.find(s => s.id === section)?.intro
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">{cat.version} · <a className="underline" href={cat.source.url} target="_blank" rel="noreferrer">{cat.source.title}</a>{cat.evidenceCap !== null && ` · Scores without evidence count at most ${cat.evidenceCap}`} · Not applicable needs a reason.</p>
      <label className="block max-w-xl text-sm"><span className="font-medium text-slate-700">Section</span>
        <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={section} onChange={e => setSection(e.target.value)}>
          {sections.map(s => <option key={s.id} value={s.id}>{s.name} ({cat.items.filter(i => i.sectionId === s.id && saved.has(i.id)).length}/{cat.items.filter(i => i.sectionId === s.id).length})</option>)}
        </select></label>
      {intro && <p className="text-sm text-slate-600">{intro}</p>}
      {locked && <p className="rounded bg-blue-50 p-2 text-sm text-blue-700">This assessment is locked ({a.status.replace('_', ' ')}).</p>}
      <ErrorLine error={error} />
      {cat.items.filter(i => i.sectionId === section).map(i => {
        const s = saved.get(i.id)
        const d = draft[i.id] ?? { score: s && !s.notApplicable ? String(s.tierLevel) : '', evidence: !!s?.evidenceUploaded, na: !!s?.notApplicable, naReason: s?.naReason ?? '' }
        const set = (x: Partial<typeof d>) => setDraft({ ...draft, [i.id]: { ...d, ...x } })
        return (
          <Card key={i.id}><CardContent className="space-y-2">
            <p className="font-semibold text-slate-800">{i.id} · {i.name} {i.critical && <Badge className="bg-rose-100 text-rose-700">critical</Badge>}</p>
            {i.description && <p className="text-sm text-slate-600">{i.description}</p>}
            <fieldset disabled={locked} className="flex flex-wrap items-end gap-3">
              {!d.na && <div className="w-64"><Select placeholder="Not scored" label="Level" value={d.score} onChange={score => set({ score })} options={cat.levels.map((l, n) => ({ value: String(n + 1), label: l }))} /></div>}
              {!d.na && <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={d.evidence} onChange={e => set({ evidence: e.target.checked })} /> Evidence held</label>}
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={d.na} onChange={e => set({ na: e.target.checked })} /> Not applicable</label>
              {d.na && <div className="min-w-[260px] flex-1"><Input label="Reason it does not apply" value={d.naReason} onChange={e => set({ naReason: e.target.value })} /></div>}
              <Button size="sm" disabled={d.na ? !d.naReason : !d.score} onClick={() => run(() => api(wsPath(workspaceId, `/assessments/${a.id}/scores/${encodeURIComponent(i.sectionId)}/${encodeURIComponent(i.id)}`), { method: 'PUT',
                body: d.na ? { notApplicable: true, naReason: d.naReason } : { score: Number(d.score), evidenceUploaded: d.evidence } }))}>Save</Button>
              {s && <StatusPill value={s.notApplicable ? 'not_applicable' : 'completed'} />}
            </fieldset>
          </CardContent></Card>
        )
      })}
    </div>
  )
}

function CatalogueScorecard({ workspaceId, a }: { workspaceId: string; a: any }) {
  const sc = useApi<any>(wsPath(workspaceId, `/assessments/${a.id}/scorecard`))
  const { run, error } = useAction()
  if (!sc.data) return <State loading={sc.loading} error={sc.error} />
  const d = sc.data
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{d.catalogue.disclaimer}</p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Overall</p><p className="text-3xl font-bold text-emerald-900">{d.overall === null ? '—' : `${d.overall}%`}</p><p className="text-sm">mean of section scores</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Completeness</p><p className="text-3xl font-bold text-emerald-900">{d.completeness}%</p></div>
        {d.sdg && <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">SDG 3.d.1</p><p className="text-3xl font-bold text-emerald-900">{d.sdg.value === null ? '—' : `${d.sdg.value}%`}</p><p className="text-xs">{d.sdg.indicator}</p></div>}
      </div>
      <Card><CardContent><div className="h-80"><ResponsiveContainer width="100%" height="100%">
        <BarChart data={d.sections.map((s: any) => ({ section: s.name.length > 28 ? `${s.name.slice(0, 26)}…` : s.name, percent: s.percent ?? 0 }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="section" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={90} /><YAxis domain={[0, 100]} /><Bar dataKey="percent" fill="#10b981" /></BarChart>
      </ResponsiveContainer></div></CardContent></Card>
      {d.critical.length > 0 && <p className="text-sm"><b>Critical items:</b> {d.critical.map((c: any) => `${c.id} ${c.effective ?? '—'}/5`).join(' · ')}</p>}
      <h3 className="font-semibold">Priorities (levels 1–2)</h3>
      <ErrorLine error={error} />
      {d.priorities.length ? <Table><Thead><tr><Th>Item</Th><Th>Level</Th><Th>Action</Th></tr></Thead>
        <Tbody>{d.priorities.map((p: any) => <tr key={p.id}><Td><b>{p.id}</b> {p.name}</Td><Td>{p.effective}/5</Td>
          <Td><Button size="sm" variant="ghost" onClick={() => run(() => api(wsPath(workspaceId, '/cap'), { method: 'POST', body: { sourceType: 'manual', findingDescription: `${d.catalogue.id}${a.reportingPeriod ? ` ${a.reportingPeriod}` : ''} · ${p.id} ${p.name}: level ${p.effective}/5`, severity: p.effective === 1 ? 'high' : 'medium', correctiveAction: `Raise ${p.name} to at least level 3` } }))}>Raise CAP</Button></Td></tr>)}</Tbody></Table>
        : <p className="text-sm text-slate-600">No items at level 1 or 2.</p>}
      <p className="text-sm text-slate-600">Open findings — {Object.entries(d.findingsBySeverity).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
    </div>
  )
}

export function AssessmentsListPage({ workspaceId }: { workspaceId: string }) {
  const list = useApi<any[]>(wsPath(workspaceId, '/assessments'))
  const [type, setType] = useState('G2G')
  const [reportingPeriod, setReportingPeriod] = useState('')
  const [innovationSupport, setInnovationSupport] = useState(false)
  const [extendedScope, setExtendedScope] = useState(false)
  const hs = useApi<any>(wsPath(workspaceId, '/health-security/catalogue'))
  const { run, error, busy } = useAction(list.reload)
  return (
    <div className="space-y-6">
      <Header title="Governance assessments" subtitle="All framework labels use the same shared governance-domain scoring. ISO and COSO labels are organizational tags, not specialized rubrics or certifications." back={{ to: '/app/workspaces/$workspaceId/dashboard', params: { workspaceId }, label: 'Dashboard' }} />
      <div className="flex items-end gap-3">
        <div className="w-72"><Select label="Framework" value={type} onChange={setType} options={[
          { value: 'CRAFT', label: 'CRAFT Governance Scorecard (10 pillars)' }, ...['G2G', 'ISO', 'COSO'].map(v => ({ value: v, label: `${v} (shared domain scoring)` })),
          ...(hs.data?.available ?? []).map((t: string) => ({ value: t, label: hs.data.labels[t] })),
        ]} /></div>
        <div className="w-40"><Input label="Reporting period" value={reportingPeriod} onChange={e => setReportingPeriod(e.target.value)} /></div>
        <Button disabled={busy} onClick={() => run(() => api(wsPath(workspaceId, '/assessments'), { method: 'POST', body: { assessmentType: type, reportingPeriod, innovationSupport: type === 'CRAFT' && innovationSupport, extendedScope: type === 'NPHI' && extendedScope } }))}>New assessment</Button>
      </div>
      {type === 'CRAFT' && <label className="flex max-w-3xl items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={innovationSupport} onChange={e => setInnovationSupport(e.target.checked)} />
        <span>This institution funds or supports innovation (incubator, accelerator, startup competition, innovation funder). Adds founder-protection criteria: fair contracting, IP safeguards for every participant, accessible dispute resolution and demonstrable safeguard accountability.</span>
      </label>}
      {type === 'NPHI' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={extendedScope} onChange={e => setExtendedScope(e.target.checked)} /> {hs.data?.catalogues.NPHI.extendedScopeLabel}</label>}
      {hs.data && !hs.data.available.length && <p className="text-xs text-slate-500">Public-sector performance and health-security assessments (NPHI, JEE, SPAR, subnational JEE) appear here for government bodies, subnational governments and national public health institutes. Set the organisation type in Organization settings.</p>}
      <ErrorLine error={error} />
      <State loading={list.loading} error={list.error} />
      <Table>
        <Thead><tr><Th>Type</Th><Th>Version</Th><Th>Period</Th><Th>Status</Th><Th>Findings</Th><Th>Started</Th></tr></Thead>
        <Tbody>{list.data?.map(a => (
          <tr key={a.id}>
            <Td><Link className="font-semibold text-emerald-700 underline" to="/app/workspaces/$workspaceId/governance/assessments/$assessmentId" params={{ workspaceId, assessmentId: String(a.id) }}>{a.assessmentType}</Link></Td>
            <Td>v{a.version}{a.innovationSupport && <Badge className="ml-1 bg-indigo-100 text-indigo-700">innovation support</Badge>}</Td><Td>{a.reportingPeriod || '—'}</Td><Td><StatusPill value={a.status} /></Td><Td>{a.findingsCount}</Td><Td>{new Date(a.startedAt).toLocaleDateString()}</Td>
          </tr>))}</Tbody>
      </Table>
    </div>
  )
}

const RUBRIC = ['1 — Absent', '2 — Initial', '3 — Defined', '4 — Implemented', '5 — Embedded and reviewed']

function useCraftCatalogue(workspaceId: string, a: any) {
  const cat = useApi<any>(a.assessmentType === 'CRAFT' ? wsPath(workspaceId, '/craft-scorecard/catalogue') : null)
  const criteria: any[] = (cat.data?.criteria ?? []).filter((c: any) => !c.appliesTo || (c.appliesTo === 'innovation_support' && a.innovationSupport))
  return { cat, criteria }
}

function CraftWizard({ workspaceId, a, reload }: { workspaceId: string; a: any; reload: () => void }) {
  const locked = a.status !== 'draft'
  const { cat, criteria } = useCraftCatalogue(workspaceId, a)
  const [pillar, setPillar] = useState('leadership')
  const [draft, setDraft] = useState<Record<string, { score: string; evidence: boolean; na: boolean; naReason: string }>>({})
  const { run, error } = useAction(reload)
  if (!cat.data) return <State loading={cat.loading} error={cat.error} />
  const saved = new Map<string, any>(a.scores.map((s: any) => [s.domain, s]))
  return (
    <div className="space-y-4">
      <Tabs tabs={cat.data.pillars.map((p: any) => ({ id: p.id, label: p.name.split(',')[0] }))} active={pillar} onChange={setPillar} />
      {locked && <p className="rounded bg-blue-50 p-2 text-sm text-blue-700">This assessment is locked ({a.status.replace('_', ' ')}).</p>}
      <p className="text-xs text-slate-500">{cat.data.pillars.find((p: any) => p.id === pillar)?.intendedOutcome} Scores without evidence count at most 2; not applicable needs a reason.</p>
      <ErrorLine error={error} />
      {criteria.filter(c => c.pillarId === pillar).map(c => {
        const s = saved.get(c.id)
        const d = draft[c.id] ?? { score: s && !s.notApplicable ? String(s.tierLevel) : '', evidence: !!s?.evidenceUploaded, na: !!s?.notApplicable, naReason: s?.naReason ?? '' }
        const set = (x: Partial<typeof d>) => setDraft({ ...draft, [c.id]: { ...d, ...x } })
        return (
          <Card key={c.id}><CardContent className="space-y-2">
            <p className="font-semibold text-slate-800">{c.id} · {c.name} {c.appliesTo && <Badge className="bg-indigo-100 text-indigo-700">founder protection</Badge>}</p>
            <p className="text-sm text-slate-600">{c.description}</p>
            <ul className="list-disc pl-5 text-sm text-slate-600">{c.assessmentQuestions.map((q: string) => <li key={q}>{q}</li>)}</ul>
            <p className="text-xs text-slate-500">Evidence: {c.evidenceRequirements.join('; ')} · Informed by: {c.sourceReferences.map((r: any) => r.framework).join('; ')}</p>
            <fieldset disabled={locked} className="flex flex-wrap items-end gap-3">
              {!d.na && <div className="w-56"><Select placeholder="Not scored" label="Rubric score" value={d.score} onChange={score => set({ score })} options={RUBRIC.map((l, i) => ({ value: String(i + 1), label: l }))} /></div>}
              {!d.na && <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={d.evidence} onChange={e => set({ evidence: e.target.checked })} /> Evidence held</label>}
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={d.na} onChange={e => set({ na: e.target.checked })} /> Not applicable</label>
              {d.na && <div className="min-w-[260px] flex-1"><Input label="Reason it does not apply" value={d.naReason} onChange={e => set({ naReason: e.target.value })} /></div>}
              <Button size="sm" disabled={d.na ? !d.naReason : !d.score} onClick={() => run(() => api(wsPath(workspaceId, `/assessments/${a.id}/scores/${c.pillarId}/${c.id}`), { method: 'PUT',
                body: d.na ? { notApplicable: true, naReason: d.naReason } : { score: Number(d.score), evidenceUploaded: d.evidence } }))}>Save</Button>
              {s && <StatusPill value={s.notApplicable ? 'not_applicable' : 'completed'} />}
            </fieldset>
          </CardContent></Card>
        )
      })}
    </div>
  )
}

const OUTCOME_LABEL: Record<string, string> = { validated: 'Validated', validated_with_qualifications: 'Validated with qualifications', not_validated: 'Not validated' }
const OUTCOME_STYLE: Record<string, string> = { validated: 'bg-emerald-100 text-emerald-700', validated_with_qualifications: 'bg-amber-100 text-amber-800', not_validated: 'bg-rose-100 text-rose-700' }

function IndependentValidation({ workspaceId, a, d, reload }: { workspaceId: string; a: any; d: any; reload: () => void }) {
  const [v, setV] = useState({ validatorName: '', validatorOrganisation: '', scope: '', method: 'document_review', outcome: 'validated', notes: '', independenceDeclared: false })
  const [rescore, setRescore] = useState<Record<string, { score: string; evidence: boolean; comment: string }>>({})
  const { run, error, busy } = useAction(reload)
  const answered: string[] = a.scores.filter((s: any) => !s.notApplicable).map((s: any) => s.domain)
  const scores = Object.fromEntries(Object.entries(rescore).filter(([, x]) => x.score).map(([id, x]) => [id, { score: Number(x.score), evidence: x.evidence, comment: x.comment }]))
  return (
    <Card><CardContent className="space-y-3">
      <h3 className="font-semibold">Independent validation</h3>
      <p className="text-sm text-slate-600">An independent reviewer checks the approved self-assessment and may re-score criteria. The self-assessed score is never overwritten; the validated score and the difference are shown alongside it. Validation is not certification or an assurance opinion.</p>
      {d.validations?.length ? <Table><Thead><tr><Th>Validator</Th><Th>Method</Th><Th>Outcome</Th><Th>Self score</Th><Th>Validated score</Th><Th>Difference</Th><Th>Date</Th></tr></Thead>
        <Tbody>{d.validations.map((x: any) => (
          <tr key={x.id}><Td>{x.validatorName}{x.validatorOrganisation && <p className="text-xs text-slate-500">{x.validatorOrganisation}</p>}</Td><Td>{x.method.replace(/_/g, ' ')}</Td>
            <Td><Badge className={OUTCOME_STYLE[x.outcome]}>{OUTCOME_LABEL[x.outcome]}</Badge>{x.notes && <p className="text-xs text-slate-500">{x.notes}</p>}</Td>
            <Td>{x.selfOverall ?? '—'}</Td><Td>{x.validatedOverall ?? '—'}{x.validatedRating && <p className="text-xs">{x.validatedRating}</p>}</Td>
            <Td className={x.delta < 0 ? 'text-rose-700' : ''}>{x.delta == null ? '—' : x.delta > 0 ? `+${x.delta}` : x.delta}</Td><Td>{new Date(x.createdAt).toLocaleDateString()}</Td></tr>))}</Tbody></Table>
        : <p className="text-sm text-slate-500">Not yet independently validated.</p>}
      {d.validations?.flatMap((x: any) => x.adjustments.map((j: any) => ({ ...j, by: x.validatorName }))).length > 0 && <ul className="list-disc pl-5 text-xs text-slate-600">
        {d.validations.flatMap((x: any) => x.adjustments.map((j: any) => <li key={`${x.id}-${j.criterionId}`}>{j.criterionId}: self {j.selfScore ?? '—'} → validator {j.validatorScore}{j.validatorEvidence ? '' : ' (no evidence)'} — {x.validatorName}{j.comment ? `: ${j.comment}` : ''}</li>))}
      </ul>}
      {a.status !== 'approved' ? <p className="text-sm text-slate-500">Independent validation opens once the assessment is approved.</p> : <>
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Validator name" value={v.validatorName} onChange={e => setV({ ...v, validatorName: e.target.value })} />
          <Input label="Validator organisation" value={v.validatorOrganisation} onChange={e => setV({ ...v, validatorOrganisation: e.target.value })} />
          <Input label="Validation scope" value={v.scope} onChange={e => setV({ ...v, scope: e.target.value })} />
          <Select label="Method" value={v.method} onChange={method => setV({ ...v, method })} options={['document_review', 'sample_testing', 'interviews', 'site_visit', 'combined'].map(x => ({ value: x, label: x.replace(/_/g, ' ') }))} />
          <Select label="Outcome" value={v.outcome} onChange={outcome => setV({ ...v, outcome })} options={Object.entries(OUTCOME_LABEL).map(([value, label]) => ({ value, label }))} />
          <Input label="Notes (required unless fully validated)" value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })} />
        </div>
        <Accordion title={`Re-score criteria (optional, ${Object.keys(scores).length} re-scored)`}>
          <div className="space-y-2 p-3">{answered.map(id => {
            const x = rescore[id] ?? { score: '', evidence: true, comment: '' }
            const set = (p: Partial<typeof x>) => setRescore({ ...rescore, [id]: { ...x, ...p } })
            return <div key={id} className="flex flex-wrap items-end gap-2">
              <span className="w-20 text-sm font-medium">{id}</span>
              <div className="w-48"><Select placeholder="Keep self score" value={x.score} onChange={score => set({ score })} options={RUBRIC.map((l, i) => ({ value: String(i + 1), label: l }))} /></div>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={x.evidence} onChange={e => set({ evidence: e.target.checked })} /> Evidence seen</label>
              <div className="min-w-[200px] flex-1"><Input aria-label={`${id} comment`} value={x.comment} onChange={e => set({ comment: e.target.value })} /></div>
            </div>
          })}</div>
        </Accordion>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={v.independenceDeclared} onChange={e => setV({ ...v, independenceDeclared: e.target.checked })} />
          <span>I declare that I am independent of the assessed institution and have no conflict of interest in this validation.</span></label>
        <ErrorLine error={error} />
        <Button disabled={busy || !v.validatorName || !v.independenceDeclared} onClick={() => run(() => api(wsPath(workspaceId, `/assessments/${a.id}/validations`), { method: 'POST', body: { ...v, scores } }))}>Record independent validation</Button>
      </>}
    </CardContent></Card>
  )
}

function CraftScorecard({ workspaceId, a }: { workspaceId: string; a: any }) {
  const sc = useApi<any>(wsPath(workspaceId, `/assessments/${a.id}/scorecard`))
  const hist = useApi<any[]>(wsPath(workspaceId, '/craft-scorecard/history'))
  const { run, error } = useAction()
  if (!sc.data) return <State loading={sc.loading} error={sc.error} />
  const d = sc.data
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><b>{d.methodology.version}{d.methodology.isProvisional ? ' — provisional' : ` — approved ${d.methodology.approvedOn}`}.</b> {d.methodology.assumptions.join(' ')}</p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Overall</p><p className="text-3xl font-bold text-emerald-900">{d.overall ?? '—'}</p><p className="text-sm">{d.rating?.level ?? (d.errors.length ? d.errors.join('; ') : 'Not scored')}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Completeness</p><p className="text-3xl font-bold text-emerald-900">{d.completeness}%</p><p className="text-sm">{d.complete ? 'All applicable criteria scored' : `${d.missingResponses.length} unanswered`}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Without evidence</p><p className="text-3xl font-bold text-amber-700">{d.unevidenced.length}</p><p className="text-sm">capped at 2</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Not applicable</p><p className="text-3xl font-bold text-slate-700">{d.notApplicable.length}</p><p className="text-sm">excluded with reasons</p></div>
      </div>
      <Card><CardContent><div className="h-80"><ResponsiveContainer width="100%" height="100%">
        <BarChart data={d.pillars.map((p: any) => ({ pillar: p.name.split(',')[0], score: p.score ?? 0 }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="pillar" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} /><YAxis domain={[0, 100]} /><Bar dataKey="score" fill="#10b981" /></BarChart>
      </ResponsiveContainer></div></CardContent></Card>
      <h3 className="font-semibold">Recommendations (lowest effective scores first)</h3>
      <ErrorLine error={error} />
      <Table><Thead><tr><Th>Criterion</Th><Th>Effective score</Th><Th>Recommended action</Th><Th>Evidence of completion</Th><Th>Action</Th></tr></Thead>
        <Tbody>{d.recommendations.map((r: any) => (
          <tr key={r.criterionId}><Td><b>{r.criterionId}</b> {r.criterion}</Td><Td><Badge className={SEVERITY_STYLE[r.priority]}>{r.effectiveScore} · {r.priority}</Badge></Td><Td>{r.action}</Td><Td className="text-xs">{r.evidence.join('; ')}</Td>
            <Td><Button size="sm" variant="ghost" onClick={() => run(() => api(wsPath(workspaceId, '/cap'), { method: 'POST', body: { sourceType: 'manual', findingDescription: `${a.reportingPeriod ? `${a.reportingPeriod} · ` : ''}${r.criterionId} ${r.criterion}: effective score ${r.effectiveScore}/5`, severity: r.priority, correctiveAction: r.action } }))}>Raise CAP</Button></Td></tr>))}</Tbody></Table>
      <p className="text-sm text-slate-600">Open findings — {Object.entries(d.findingsBySeverity).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
      <IndependentValidation workspaceId={workspaceId} a={a} d={d} reload={sc.reload} />
      {hist.data && hist.data.length > 1 && <>
        <h3 className="font-semibold">History across reporting periods</h3>
        <Table><Thead><tr><Th>Version</Th><Th>Period</Th><Th>Status</Th><Th>Overall</Th><Th>Rating</Th><Th>Completeness</Th><Th>Independent validation</Th></tr></Thead>
          <Tbody>{hist.data.map(h => <tr key={h.id}><Td>v{h.version}</Td><Td>{h.reportingPeriod || '—'}</Td><Td><StatusPill value={h.status} /></Td><Td>{h.overall ?? '—'}</Td><Td>{h.rating ?? '—'}</Td><Td>{h.completeness}%</Td>
            <Td>{h.validation ? <Badge className={OUTCOME_STYLE[h.validation.outcome]}>{OUTCOME_LABEL[h.validation.outcome]}</Badge> : '—'}</Td></tr>)}</Tbody></Table>
        <p className="text-xs text-slate-500">Compare periods only where scope, criteria and methodology version are the same.</p>
      </>}
    </div>
  )
}

function ScoringWizard({ workspaceId, a, reload }: { workspaceId: string; a: any; reload: () => void }) {
  if (a.assessmentType === 'CRAFT') return <CraftWizard workspaceId={workspaceId} a={a} reload={reload} />
  if (CATALOGUE_TYPES.includes(a.assessmentType)) return <CatalogueWizard workspaceId={workspaceId} a={a} reload={reload} />
  if (a.assessmentType === 'AAR' || a.assessmentType === 'SIMEX') return <p className="rounded bg-slate-50 p-3 text-sm text-slate-700">{a.assessmentType === 'AAR' ? 'After-action reviews' : 'Simulation exercises'} record what worked and what did not as findings against the JEE technical areas. Use the Findings tab, then raise corrective actions.</p>
  return <DomainWizard workspaceId={workspaceId} a={a} reload={reload} />
}

function DomainWizard({ workspaceId, a, reload }: { workspaceId: string; a: any; reload: () => void }) {
  const locked = a.status !== 'draft'
  const [pillar, setPillar] = useState(Object.keys(GOVERNANCE_DOMAINS)[0])
  const [draft, setDraft] = useState<Record<string, number>>({})
  const { run, error } = useAction(reload)
  const byKey = new Map<string, any>(a.scores.map((s: any) => [`${s.pillar}|${s.domain}`, s]))
  const save = (domain: string, score: number, evidence: boolean) =>
    run(() => api(wsPath(workspaceId, `/assessments/${a.id}/scores/${encodeURIComponent(pillar)}/${encodeURIComponent(domain)}`), { method: 'PUT', body: { score, evidenceUploaded: evidence } }))
  return (
    <div className="space-y-4">
      <Tabs tabs={Object.keys(GOVERNANCE_DOMAINS).map(p => ({ id: p, label: p }))} active={pillar} onChange={setPillar} />
      {locked && <p className="rounded bg-blue-50 p-2 text-sm text-blue-700">This assessment is locked ({a.status.replace('_', ' ')}).</p>}
      <ErrorLine error={error} />
      {GOVERNANCE_DOMAINS[pillar].map(domain => {
        const saved = byKey.get(`${pillar}|${domain}`)
        const value = draft[domain] ?? (saved ? saved.tierLevel : 0)
        return (
          <Card key={domain}><CardContent className="flex flex-wrap items-center gap-4">
            <span className="w-56 font-medium text-slate-800">{domain}</span>
            <input type="range" min={0} max={5} step={1} value={value} disabled={locked} aria-label={`${domain} score`}
              onChange={e => setDraft({ ...draft, [domain]: Number(e.target.value) })} className="flex-1" />
            <Badge className="bg-emerald-100 text-emerald-800">{value === 0 ? 'Not scored' : TIER_LABEL(value)}</Badge>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" disabled={locked} checked={!!saved?.evidenceUploaded} onChange={e => save(domain, value, e.target.checked)} /> Evidence
            </label>
            <Button size="sm" disabled={locked} onClick={() => save(domain, value, !!saved?.evidenceUploaded)}>Save</Button>
          </CardContent></Card>
        )
      })}
    </div>
  )
}

function FindingsTab({ workspaceId, a, reload }: { workspaceId: string; a: any; reload: () => void }) {
  const { criteria } = useCraftCatalogue(workspaceId, a)
  const hsDomains = healthSecurityDomains(a)
  const domains = a.assessmentType === 'CRAFT' ? criteria.map((c: any) => ({ value: c.id, label: `${c.id} ${c.name}` })) : hsDomains ?? ALL_DOMAINS.map(d => ({ value: d.domain, label: d.domain }))
  const [f, setF] = useState({ domain: a.assessmentType === 'CRAFT' ? 'LDR-1' : hsDomains?.[0].value ?? ALL_DOMAINS[0].domain, severity: 'medium', description: '', sensitive: false, ownerAssignment: '', dueDate: '', recommendation: '', evidenceLink: '' })
  const { run, error } = useAction(reload)
  const locked = a.status === 'approved'
  return (
    <div className="space-y-4">
      {!locked && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-60"><Select label={a.assessmentType === 'CRAFT' || hsDomains ? 'Criterion / area' : 'Domain'} value={f.domain} onChange={domain => setF({ ...f, domain })} options={domains} /></div>
          <div className="w-36"><Select label="Severity" value={f.severity} onChange={severity => setF({ ...f, severity })} options={['critical', 'high', 'medium', 'low'].map(v => ({ value: v, label: v }))} /></div>
          <div className="min-w-[240px] flex-1"><Input label="Description" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
          <Input label="Owner assignment" value={f.ownerAssignment} onChange={e => setF({ ...f, ownerAssignment: e.target.value })} />
          <Input label="Finding due date" type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} />
          <Input label="Recommendation" value={f.recommendation} onChange={e => setF({ ...f, recommendation: e.target.value })} />
          <Input label="Evidence reference" value={f.evidenceLink} onChange={e => setF({ ...f, evidenceLink: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.sensitive} onChange={e => setF({ ...f, sensitive: e.target.checked })} /> Contains sensitive personal details</label>
          <Button disabled={!f.description} onClick={() => run(() => api(wsPath(workspaceId, `/assessments/${a.id}/findings`), { method: 'POST', body: { ...f, dueDate: f.dueDate || null } }))}>Add finding</Button>
        </div>
      )}
      <ErrorLine error={error} />
      <Table>
        <Thead><tr><Th>Domain</Th><Th>Severity</Th><Th>Description</Th><Th>Owner</Th><Th>Due</Th><Th>Status</Th><Th>Action</Th></tr></Thead>
        <Tbody>{a.findings.map((x: any) => (
          <tr key={x.id}>
            <Td>{x.domain}</Td><Td><Badge className={SEVERITY_STYLE[x.severity]}>{x.severity}</Badge></Td><Td>{x.description}</Td>
            <Td>{x.ownerAssignment ?? '—'}</Td><Td>{x.dueDate ?? '—'}</Td>
            <Td>
              <select aria-label="Finding status" disabled={locked} value={x.status} className="rounded border border-slate-300 text-xs"
                onChange={e => run(() => api(wsPath(workspaceId, `/assessments/${a.id}/findings/${x.id}`), { method: 'PUT', body: { status: e.target.value } }))}>
                {['open', 'in_progress', 'resolved'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </Td>
            <Td><Button size="sm" variant="ghost" onClick={() => run(() => api(wsPath(workspaceId, '/cap'), { method: 'POST', body: { sourceType: 'governance_finding', sourceId: x.id } }))}>Raise corrective action</Button></Td>
          </tr>))}</Tbody>
      </Table>
      {a.findings.map((x: any) => <Card key={x.id}><CardContent className="space-y-3">
        <h3 className="font-semibold">Finding #{x.id} details</h3>
        <EditFields initial={x} disabled={locked} fields={[
          { name: 'ownerAssignment', label: 'Owner assignment' }, { name: 'dueDate', label: 'Due date', type: 'date' },
          { name: 'recommendation', label: 'Recommendation' }, { name: 'evidenceLink', label: 'Evidence reference' },
        ]} save={async body => { await api(wsPath(workspaceId, `/assessments/${a.id}/findings/${x.id}`), { method: 'PUT', body }); reload() }} />
      </CardContent></Card>)}
    </div>
  )
}

function ScorecardTab({ workspaceId, assessmentId }: { workspaceId: string; assessmentId: string }) {
  const sc = useApi<any>(wsPath(workspaceId, `/assessments/${assessmentId}/scorecard`))
  if (!sc.data) return <State loading={sc.loading} error={sc.error} />
  const radar = ALL_DOMAINS.map(d => ({ domain: d.domain, tier: sc.data.domains.find((x: any) => x.domain === d.domain)?.tier ?? 0 }))
  const bars = Object.entries(sc.data.pillars).map(([pillar, v]: any) => ({ pillar, tier: Math.round(v.avgTier * 10) / 10 }))
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Overall: <b>{sc.data.overallTier.toFixed(1)}</b> · Risk classification: <Badge className="bg-amber-100 text-amber-800">{sc.data.risk ?? 'Not scored'}</Badge></p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent><div className="h-80"><ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radar}><PolarGrid /><PolarAngleAxis dataKey="domain" tick={{ fontSize: 9 }} /><Radar dataKey="tier" stroke="#059669" fill="#10b981" fillOpacity={0.4} /></RadarChart>
        </ResponsiveContainer></div></CardContent></Card>
        <Card><CardContent><div className="h-80"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="pillar" tick={{ fontSize: 11 }} /><YAxis domain={[0, 5]} /><Bar dataKey="tier" fill="#10b981" /></BarChart>
        </ResponsiveContainer></div></CardContent></Card>
      </div>
      <p className="text-sm text-slate-600">Open findings — {Object.entries(sc.data.findingsBySeverity).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
    </div>
  )
}

export function AssessmentDetailPage({ workspaceId, assessmentId, review = false }: { workspaceId: string; assessmentId: string; review?: boolean }) {
  const a = useApi<any>(wsPath(workspaceId, `/assessments/${assessmentId}`))
  const [tab, setTab] = useState(review ? 'review' : 'overview')
  const [comments, setComments] = useState('')
  const { run, error } = useAction(a.reload)
  if (!a.data) return <State loading={a.loading} error={a.error} />
  const d = a.data
  const tabs = [{ id: 'overview', label: 'Overview' }, { id: 'wizard', label: 'Scoring Wizard' }, { id: 'findings', label: 'Findings' }, { id: 'scorecard', label: 'Scorecard' }, ...(review ? [{ id: 'review', label: 'Review' }] : [])]
  const act = (what: string) => run(() => api(wsPath(workspaceId, `/assessments/${assessmentId}/${what}`), { method: 'POST', body: { comments } }))
  return (
    <div className="space-y-6">
      <Header title={d.assessmentType === 'CRAFT' ? `CRAFT Governance Scorecard v${d.version}${d.reportingPeriod ? ` — ${d.reportingPeriod}` : ''}` : `${RESTRICTED_LABELS[d.assessmentType] ?? `${d.assessmentType} assessment`} v${d.version}${d.reportingPeriod ? ` — ${d.reportingPeriod}` : ''}`}
        subtitle={d.assessmentType === 'CRAFT' ? 'Ten-pillar CRAFT methodology (CRAFT-GS 1.0). Not a certification, credit rating, assurance opinion or official score of any governance code.' : catalogueByType(d.assessmentType)?.disclaimer ?? (d.assessmentType === 'AAR' || d.assessmentType === 'SIMEX' ? 'IHR Monitoring and Evaluation Framework: findings by JEE technical area.' : 'Shared governance-domain scoring — not a specialized ISO/COSO rubric or certification.')} back={{ to: '/app/workspaces/$workspaceId/governance/assessments', params: { workspaceId }, label: 'Assessments' }} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <ErrorLine error={error} />
      {tab === 'overview' && (
        <Card><CardContent className="space-y-2 text-sm">
          <p>Status: <StatusPill value={d.status} /></p><p>Created by {d.createdBy}</p><p>Started {new Date(d.startedAt).toLocaleString()}</p>
          <p>Completed {d.completedAt ? new Date(d.completedAt).toLocaleString() : '—'}</p><p>{d.findingsCount} finding(s) · {d.scores.length} {d.assessmentType === 'CRAFT' ? 'criteria' : `/${ALL_DOMAINS.length} domains`} scored</p>
          {d.status === 'draft' && <Button onClick={() => act('submit')}>Submit for review</Button>}
          <p><Link className="text-emerald-700 underline" to="/app/workspaces/$workspaceId/governance/assessments/$assessmentId/review" params={{ workspaceId, assessmentId }}>Admin review mode</Link></p>
        </CardContent></Card>
      )}
      {tab === 'wizard' && <ScoringWizard workspaceId={workspaceId} a={d} reload={a.reload} />}
      {tab === 'findings' && <FindingsTab workspaceId={workspaceId} a={d} reload={a.reload} />}
      {tab === 'scorecard' && (d.assessmentType === 'CRAFT' ? <CraftScorecard workspaceId={workspaceId} a={d} /> : CATALOGUE_TYPES.includes(d.assessmentType) ? <CatalogueScorecard workspaceId={workspaceId} a={d} /> : d.assessmentType === 'AAR' || d.assessmentType === 'SIMEX' ? <p className="text-sm text-slate-600">{d.findingsCount} finding(s) recorded. See the Findings tab.</p> : <ScorecardTab workspaceId={workspaceId} assessmentId={assessmentId} />)}
      {tab === 'review' && (
        <Card><CardContent className="space-y-3">
          <p className="text-sm text-slate-600">Status: <StatusPill value={d.status} />. Edits are locked while in review. Approval requires the admin role and a reviewer other than the creator.</p>
          <Input label="Comments" value={comments} onChange={e => setComments(e.target.value)} />
          <div className="flex gap-2"><Button disabled={d.status !== 'in_review'} onClick={() => act('approve')}>Approve</Button>
            <Button variant="destructive" disabled={d.status !== 'in_review'} onClick={() => act('reject')}>Return to draft</Button></div>
        </CardContent></Card>
      )}
    </div>
  )
}
