import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Tabs } from '../components/ui'
import { api, training } from '../lib/trainingClient'
import { RUBRIC_LEVELS } from '../lib/validatorTraining'

// Validator system PR 4: the marking queue and the content editor for the CRAFT programme
// team (platform admin, programme_team) and Lead Validators (marking only). Content is data:
// edits and pasted YouTube links take effect without a code change. The server enforces who
// may edit or mark; this page only hides what it would refuse.

const Note = ({ msg }: { msg: { ok: boolean; text: string } | null }) => msg ? <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p> : null
type Msg = { ok: boolean; text: string } | null
const area = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal'

function Field({ label, value, onChange, rows = 3, mono }: { label: string; value: string; onChange: (v: string) => void; rows?: number; mono?: boolean }) {
  return (
    <label className="block text-sm font-medium text-slate-700">{label}
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={`${area} ${mono ? 'font-mono text-xs' : ''}`} />
    </label>
  )
}
const pretty = (v: unknown) => JSON.stringify(v, null, 2)

export function TrainingManagePage() {
  const [me, setMe] = useState<any>(null)
  const [tab, setTab] = useState('marking')
  useEffect(() => { void training('me').then((m) => { setMe(m); if (!m.isMarker) setTab('') }, () => {}) }, [])
  if (!me) return <p className="text-sm text-slate-500">Loading…</p>
  if (!me.isMarker) return <p role="alert" className="text-sm text-rose-700">This page is for the CRAFT programme team and Lead Validators.</p>
  const tabs = [{ id: 'marking', label: 'Marking queue' }, ...(me.isProgrammeTeam ? [{ id: 'modules', label: 'Modules and videos' }, { id: 'questions', label: 'Question bank' }, { id: 'cases', label: 'Cases and capstone' }, { id: 'calibration', label: 'Calibration items' }, { id: 'badges', label: 'Badges' }, { id: 'baseline', label: 'Pre/post results' }] : []), ...(me.isAdmin ? [{ id: 'team', label: 'Programme team' }] : [])]
  return (
    <div className="space-y-5">
      <Link to="/training" className="text-sm text-emerald-700 hover:underline">← Training</Link>
      <h1 className="font-display text-3xl font-bold text-emerald-900">Programme team</h1>
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'marking' && <Marking />}
      {me.isProgrammeTeam && ['modules', 'questions', 'cases', 'calibration', 'badges'].includes(tab) && <Content kind={tab} />}
      {tab === 'team' && me.isAdmin && <Team />}
      {tab === 'baseline' && me.isProgrammeTeam && <BaselineSummary />}
    </div>
  )
}

// Explainer-video pre- and post-tests: per-module averages and the change for learners who took both. No names.
function BaselineSummary() {
  const [rows, setRows] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { void api<{ modules: any[] }>('/api/training-baseline/summary').then((r) => setRows(r.modules), (e) => setError(e.message)) }, [])
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  if (!rows) return <p className="text-sm text-slate-500">Loading…</p>
  const cell = (n: number, pct: number | null) => (n ? `${pct}% (${n})` : '–')
  return (
    <Card>
      <CardHeader><CardTitle>Pre-test and post-test results</CardTitle>
        <p className="text-sm text-slate-500">Mean % correct per module, with the number of learners in brackets. Change compares each learner's first pre-test with their latest post-test. Practice only; separate from the exam.</p></CardHeader>
      <CardContent>
        <table className="w-full text-left text-sm">
          <thead><tr className="text-slate-500"><th className="py-1">Module</th><th>Pre-test</th><th>Post-test</th><th>Change (learners with both)</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.moduleId} className="border-t border-slate-100">
              <td className="py-1 font-mono">{r.moduleId.toUpperCase()}</td><td>{cell(r.pre.n, r.pre.meanPct)}</td><td>{cell(r.post.n, r.post.meanPct)}</td>
              <td>{r.paired.n ? `${r.paired.changePct >= 0 ? '+' : ''}${r.paired.changePct} points (${r.paired.n})` : '–'}</td>
            </tr>))}</tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function Marking() {
  const [queue, setQueue] = useState<any[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const load = () => training('marking/queue').then(setQueue, () => setQueue([]))
  useEffect(() => { void load() }, [])
  if (open) return <MarkOne id={open} done={() => { setOpen(null); void load() }} />
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Scenario cases need two different markers; the capstone needs one. You can’t mark your own work.</p>
      {queue && !queue.length && <p className="text-sm text-slate-500">Nothing is waiting to be marked.</p>}
      <ul className="space-y-2">
        {queue?.map((q) => (
          <li key={q.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <span className="font-medium">{q.title}</span><span className="text-slate-500">{q.learner} · attempt {q.attempt} · {new Date(q.submittedAt).toLocaleDateString()}</span>
            <Badge variant="outline">{q.marksReceived}/{q.marksNeeded} marks</Badge>
            {q.own ? <span className="text-slate-500">your own work</span> : q.markedByMe ? <span className="text-slate-500">you have marked this</span> : <Button size="sm" onClick={() => setOpen(q.id)}>Mark</Button>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MarkOne({ id, done }: { id: string; done: () => void }) {
  const [d, setD] = useState<any>(null)
  const [percent, setPercent] = useState('')
  const [crit, setCrit] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [msg, setMsg] = useState<Msg>(null)
  useEffect(() => { training(`marking/${id}`).then(setD, (e) => setMsg({ ok: false, text: e.message })) }, [id])
  if (!d) return <Note msg={msg} />
  const body = d.body
  const isCase = d.kind === 'case'
  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={done}>← Queue</Button>
      <Card>
        <CardHeader><CardTitle>{isCase ? d.case.title : d.capstone.title} (attempt {d.attempt})</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {isCase ? (
            <>
              <p className="text-slate-700"><strong>The case:</strong> {d.case.prompt}</p>
              <p className="rounded bg-emerald-50 p-3 text-emerald-900"><strong>Model answer (markers look for judgement, not one right sentence):</strong> {d.case.modelAnswer}</p>
              <div className="rounded border border-slate-200 p-3"><strong>The learner’s answer ({body.words} words):</strong><p className="mt-1 whitespace-pre-line">{body.text}</p></div>
            </>
          ) : (
            <>
              <p className="rounded bg-emerald-50 p-3 text-emerald-900"><strong>Well-reasoned answer:</strong> {d.capstone.modelAnswer}</p>
              {d.capstone.accuracy && <p>Scoring accuracy against the reference scores: {d.capstone.accuracy.within} of {d.capstone.accuracy.total} within 1 point ({d.capstone.accuracy.pct}%; “Meets” needs 80%).</p>}
              <div className="rounded border border-slate-200 p-3 space-y-1">
                <p><strong>Declaration:</strong> {body.declaration}</p>
                <p><strong>Scores:</strong></p>
                <ul>{Object.entries(body.scores as Record<string, { score: number; note: string }>).map(([k, v]) => <li key={k}><span className="font-mono text-xs">{k}</span> {v.score} (reference {d.capstone.referenceScores[k] ?? '–'}): {v.note}</li>)}</ul>
                <p><strong>Debrief:</strong> {body.debrief}</p>
                <p><strong>Outcome:</strong> {body.outcome}, rung {body.ratedRung}, {body.validityMonths} months</p>
                <p><strong>Qualifications:</strong> {body.qualifications || 'none'}</p>
                <p><strong>Follow-up:</strong> {body.followUp}</p>
                <p><strong>Material events:</strong> {body.materialEvents}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      {!d.markedByMe && (
        <Card>
          <CardHeader><CardTitle>Your mark</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {isCase ? <Input label="Percentage (0-100); 70 passes" type="number" min={0} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} /> : (
              <div className="space-y-2">
                {d.capstone.rubric.map((r: any) => (
                  <label key={r.key} className="block text-sm text-slate-700"><strong>{r.name}</strong> ({r.mustMeet ? 'must meet' : r.weight}) <span className="text-slate-500">Meets: {r.meets}</span>
                    <select value={crit[r.key] ?? ''} onChange={(e) => setCrit({ ...crit, [r.key]: Number(e.target.value) })} className="ml-2 rounded border border-slate-300 px-2 py-1">
                      <option value="" disabled>Rate</option>{Object.entries(RUBRIC_LEVELS).map(([v, l]) => <option key={v} value={v}>{v} {l}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            )}
            <Field label="Feedback for the learner (shown once the result is final)" value={comment} onChange={setComment} />
            <Button onClick={async () => {
              try {
                const r = await training(`marking/${id}`, { method: 'POST', json: isCase ? { percent: Number(percent), comment } : { criteria: crit, comment } })
                setMsg({ ok: true, text: r.status === 'pending' ? 'Mark recorded; waiting for the second marker' : `Recorded: ${r.status}` }); setTimeout(done, 1200)
              } catch (e: any) { setMsg({ ok: false, text: e.message }) }
            }}>Record my mark</Button>
            <Note msg={msg} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Content({ kind }: { kind: string }) {
  const [c, setC] = useState<any>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const load = () => training('manage/content').then(setC, (e) => setMsg({ ok: false, text: e.message }))
  useEffect(() => { void load() }, [])
  if (!c) return <Note msg={msg} />
  const save = async (path: string, method: string, json: unknown, ok = 'Saved') => {
    try { await training(path, { method, json }); setMsg({ ok: true, text: ok }); await load(); return true } catch (e: any) { setMsg({ ok: false, text: e.message }); return false }
  }
  return (
    <div className="space-y-4">
      <Note msg={msg} />
      {kind === 'modules' && c.modules.map((m: any) => <ModuleEditor key={`${m.id}-${m.revision}`} m={m} save={save} />)}
      {kind === 'questions' && <Questions questions={c.questions} modules={c.modules} save={save} />}
      {kind === 'cases' && <Cases cases={c.cases} capstones={c.capstones} save={save} />}
      {kind === 'calibration' && <Calibration items={c.calibration} save={save} />}
      {kind === 'badges' && c.badges.map((b: any) => <BadgeEditor key={b.key} b={b} save={save} />)}
    </div>
  )
}

function ModuleEditor({ m, save }: { m: any; save: (p: string, method: string, json: unknown, ok?: string) => Promise<boolean> }) {
  const [f, setF] = useState({ title: m.title, outcome: m.outcome, script: m.script, youtubeUrl: m.youtubeUrl ?? '', videoSeconds: m.videoSeconds ? String(m.videoSeconds) : '', reflectionPrompt: m.reflectionPrompt, exercises: pretty(m.exercises), scenario: pretty(m.scenario) })
  const [err, setErr] = useState('')
  return (
    <Card>
      <CardHeader><CardTitle>Module {m.position}. {m.title}</CardTitle><p className="text-xs text-slate-500">Revision {m.revision}. Validators watch each module once a year for renewal; changing the script or video does not reset anyone's watching.</p></CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault()
          let exercises, scenario
          try { exercises = JSON.parse(f.exercises); scenario = JSON.parse(f.scenario) } catch { setErr('Exercises and scenario must be valid JSON'); return }
          setErr('')
          await save(`manage/modules/${m.id}`, 'PUT', { title: f.title, outcome: f.outcome, script: f.script, youtubeUrl: f.youtubeUrl.trim() || null, videoSeconds: f.videoSeconds.trim() ? Number(f.videoSeconds) : null, reflectionPrompt: f.reflectionPrompt, exercises, scenario })
        }}>
          <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input label="Outcome" value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })} />
          <Input label="YouTube link (unlisted video on youtube.com/@DiBadiliTV; leave empty to show the script)" value={f.youtubeUrl} onChange={(e) => setF({ ...f, youtubeUrl: e.target.value })} placeholder="https://youtu.be/…" />
          <Input label="Video length in seconds (required with a link; watching is credited against it)" type="number" min={1} value={f.videoSeconds} onChange={(e) => setF({ ...f, videoSeconds: e.target.value })} placeholder="e.g. 760" />
          <Field label="Written script (also the transcript)" rows={8} value={f.script} onChange={(v) => setF({ ...f, script: v })} />
          <Field label="Reflection prompt" rows={2} value={f.reflectionPrompt} onChange={(v) => setF({ ...f, reflectionPrompt: v })} />
          <details><summary className="cursor-pointer text-sm font-medium text-slate-700">Exercises and scenario (JSON)</summary>
            <div className="mt-2 space-y-3"><Field label="Exercises" rows={10} mono value={f.exercises} onChange={(v) => setF({ ...f, exercises: v })} /><Field label="Scenario" rows={10} mono value={f.scenario} onChange={(v) => setF({ ...f, scenario: v })} /></div></details>
          {err && <p role="alert" className="text-sm text-rose-700">{err}</p>}
          <Button type="submit">Save module</Button>
        </form>
      </CardContent>
    </Card>
  )
}

type Saver = (p: string, method: string, json: unknown, ok?: string) => Promise<boolean>
const blankQ = { id: '', moduleId: '', topic: '', prompt: '', options: '', correctIndex: '0', explanation: '', forCheck: true, forExam: false, active: true }

function Questions({ questions, modules, save }: { questions: any[]; modules: any[]; save: Saver }) {
  const [edit, setEdit] = useState<any>(null)
  const [filter, setFilter] = useState('')
  const shown = questions.filter((q) => !filter || q.prompt.toLowerCase().includes(filter.toLowerCase()) || q.moduleId === filter)
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{questions.filter((q) => q.forExam && q.active).length} active exam questions (the exam draws 40; grow the bank to at least 120). {questions.filter((q) => q.forCheck && q.active).length} active module-check questions.</p>
      <div className="flex flex-wrap items-end gap-3"><div className="w-64"><Input label="Filter by text or module id" value={filter} onChange={(e) => setFilter(e.target.value)} /></div><Button variant="outline" onClick={() => setEdit({ ...blankQ })}>Add a question</Button></div>
      {edit && (
        <Card><CardContent className="pt-6">
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault()
            const body = { moduleId: edit.moduleId || null, topic: edit.topic, prompt: edit.prompt, options: edit.options.split('\n').map((x: string) => x.trim()).filter(Boolean), correctIndex: Number(edit.correctIndex), explanation: edit.explanation, forCheck: edit.forCheck, forExam: edit.forExam, active: edit.active }
            if (await save(edit.id ? `manage/questions/${edit.id}` : 'manage/questions', edit.id ? 'PUT' : 'POST', body)) setEdit(null)
          }}>
            <Field label="Question" rows={2} value={edit.prompt} onChange={(v) => setEdit({ ...edit, prompt: v })} />
            <Field label="Options (one per line)" rows={4} value={edit.options} onChange={(v) => setEdit({ ...edit, options: v })} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Correct option number (0 = first)" type="number" min={0} value={edit.correctIndex} onChange={(e) => setEdit({ ...edit, correctIndex: e.target.value })} />
              <label className="text-sm font-medium text-slate-700">Module (for the module check)
                <select value={edit.moduleId} onChange={(e) => setEdit({ ...edit, moduleId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm font-normal"><option value="">None</option>{modules.map((m) => <option key={m.id} value={m.id}>Module {m.position}</option>)}</select></label>
              <Input label="Topic" value={edit.topic} onChange={(e) => setEdit({ ...edit, topic: e.target.value })} />
            </div>
            <Field label="Explanation shown after answering" rows={2} value={edit.explanation} onChange={(v) => setEdit({ ...edit, explanation: v })} />
            <div className="flex flex-wrap gap-4 text-sm">
              {(['forCheck', 'forExam', 'active'] as const).map((k) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.checked })} className="h-4 w-4 accent-emerald-600" />{{ forCheck: 'Module check', forExam: 'Exam', active: 'Active' }[k]}</label>)}
            </div>
            <div className="flex gap-2"><Button type="submit">Save question</Button><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
          </form>
        </CardContent></Card>
      )}
      <ul className="space-y-1">
        {shown.map((q) => (
          <li key={q.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-100 bg-white p-2 text-sm">
            <span className="flex-1 min-w-[16rem]">{q.prompt}</span>
            {q.moduleId && <Badge variant="outline">{q.moduleId}</Badge>}{q.forExam && <Badge className="bg-indigo-100 text-indigo-800">exam</Badge>}{q.forCheck && <Badge className="bg-emerald-100 text-emerald-800">check</Badge>}{!q.active && <Badge className="bg-slate-200 text-slate-700">inactive</Badge>}
            <Button size="sm" variant="ghost" onClick={() => setEdit({ ...q, moduleId: q.moduleId ?? '', options: q.options.join('\n'), correctIndex: String(q.correctIndex) })}>Edit</Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Cases({ cases, capstones, save }: { cases: any[]; capstones: any[]; save: Saver }) {
  return (
    <div className="space-y-4">
      {cases.map((c) => <CaseEditor key={c.id} c={c} save={save} />)}
      <CaseEditor save={save} />
      <h2 className="pt-2 text-lg font-semibold text-slate-800">Capstone cases</h2>
      {capstones.map((c) => <CapstoneEditor key={c.id} c={c} save={save} />)}
      <CapstoneEditor save={save} template={capstones[0]} />
    </div>
  )
}

function CaseEditor({ c, save }: { c?: any; save: Saver }) {
  const [f, setF] = useState({ title: c?.title ?? '', topic: c?.topic ?? '', prompt: c?.prompt ?? '', modelAnswer: c?.modelAnswer ?? '', active: c?.active ?? true })
  return (
    <Card>
      <CardHeader><CardTitle>{c ? c.title : 'Add a scenario case'}</CardTitle></CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await save(c ? `manage/cases/${c.id}` : 'manage/cases', c ? 'PUT' : 'POST', f) && !c) setF({ title: '', topic: '', prompt: '', modelAnswer: '', active: true }) }}>
          <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Field label="The case (what the learner reads)" value={f.prompt} onChange={(v) => setF({ ...f, prompt: v })} />
          <Field label="Model answer (markers only)" value={f.modelAnswer} onChange={(v) => setF({ ...f, modelAnswer: v })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="h-4 w-4 accent-emerald-600" />Active (every active case must be passed)</label>
          <Button type="submit">{c ? 'Save case' : 'Add case'}</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function CapstoneEditor({ c, save, template }: { c?: any; save: Saver; template?: any }) {
  const src = c ?? { title: '', brief: '', modelAnswer: '', evidence: [], referenceScores: {}, rubric: template?.rubric ?? [], active: true }
  const [f, setF] = useState({ title: src.title, brief: src.brief, modelAnswer: src.modelAnswer, evidence: pretty(src.evidence), referenceScores: pretty(src.referenceScores), rubric: pretty(src.rubric), active: src.active })
  const [err, setErr] = useState('')
  return (
    <Card>
      <CardHeader><CardTitle>{c ? c.title : 'Add a capstone case (needed for retakes)'}</CardTitle></CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault()
          let evidence, referenceScores, rubric
          try { evidence = JSON.parse(f.evidence); referenceScores = JSON.parse(f.referenceScores); rubric = JSON.parse(f.rubric) } catch { setErr('Evidence, reference scores and rubric must be valid JSON'); return }
          setErr('')
          await save(c ? `manage/capstones/${c.id}` : 'manage/capstones', c ? 'PUT' : 'POST', { title: f.title, brief: f.brief, modelAnswer: f.modelAnswer, evidence, referenceScores, rubric, active: f.active })
        }}>
          <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Field label="Brief" rows={5} value={f.brief} onChange={(v) => setF({ ...f, brief: v })} />
          <Field label="Well-reasoned answer (markers only)" value={f.modelAnswer} onChange={(v) => setF({ ...f, modelAnswer: v })} />
          <details><summary className="cursor-pointer text-sm font-medium text-slate-700">Evidence file, reference scores and rubric (JSON)</summary>
            <div className="mt-2 space-y-3"><Field label="Evidence [{title, body}]" rows={8} mono value={f.evidence} onChange={(v) => setF({ ...f, evidence: v })} /><Field label="Reference scores {indicatorId: 0-5}" rows={6} mono value={f.referenceScores} onChange={(v) => setF({ ...f, referenceScores: v })} /><Field label="Rubric [{key, name, weight, mustMeet, meets}]" rows={10} mono value={f.rubric} onChange={(v) => setF({ ...f, rubric: v })} /></div></details>
          {err && <p role="alert" className="text-sm text-rose-700">{err}</p>}
          <Button type="submit">{c ? 'Save capstone' : 'Add capstone'}</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function Calibration({ items, save }: { items: any[]; save: Saver }) {
  const [n, setN] = useState({ statement: '', referenceScore: '3' })
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{items.filter((i) => i.active).length} active items. Each drill draws 10 at random; keep the pool large so renewal drills are fresh.</p>
      <form className="grid gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end" onSubmit={async (e) => { e.preventDefault(); if (await save('manage/calibration', 'POST', { statement: n.statement, referenceScore: Number(n.referenceScore) })) setN({ statement: '', referenceScore: '3' }) }}>
        <Input label="New indicator description" required value={n.statement} onChange={(e) => setN({ ...n, statement: e.target.value })} />
        <Input label="Reference (0-5)" type="number" min={0} max={5} value={n.referenceScore} onChange={(e) => setN({ ...n, referenceScore: e.target.value })} />
        <Button type="submit" variant="outline">Add</Button>
      </form>
      <ul className="space-y-1">{items.map((i) => <CalRow key={i.id} i={i} save={save} />)}</ul>
    </div>
  )
}
function CalRow({ i, save }: { i: any; save: Saver }) {
  const [f, setF] = useState({ statement: i.statement, referenceScore: String(i.referenceScore), active: i.active })
  return (
    <li className="grid gap-2 rounded border border-slate-100 bg-white p-2 sm:grid-cols-[1fr_6rem_auto_auto] sm:items-center">
      <input aria-label="Indicator description" value={f.statement} onChange={(e) => setF({ ...f, statement: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      <input aria-label="Reference score" type="number" min={0} max={5} value={f.referenceScore} onChange={(e) => setF({ ...f, referenceScore: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="accent-emerald-600" />Active</label>
      <Button size="sm" variant="outline" onClick={() => void save(`manage/calibration/${i.id}`, 'PUT', { statement: f.statement, referenceScore: Number(f.referenceScore), active: f.active })}>Save</Button>
    </li>
  )
}

function BadgeEditor({ b, save }: { b: any; save: Saver }) {
  const [f, setF] = useState({ name: b.name, criteria: b.criteria, active: b.active })
  return (
    <Card><CardContent className="space-y-2 pt-6">
      <p className="font-mono text-xs text-slate-500">{b.key}: awarded by code from the learning record; only the wording is editable. Never volume, rungs, speed or fees.</p>
      <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Field label="Criteria" rows={2} value={f.criteria} onChange={(v) => setF({ ...f, criteria: v })} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="h-4 w-4 accent-emerald-600" />Show on profiles</label>
      <Button onClick={() => void save(`manage/badges/${b.key}`, 'PUT', f)}>Save badge</Button>
    </CardContent></Card>
  )
}

function Team() {
  const [staff, setStaff] = useState<any[]>([])
  const [n, setN] = useState({ email: '', role: 'programme_team' })
  const [msg, setMsg] = useState<Msg>(null)
  const load = () => training('manage/staff').then(setStaff, () => {})
  useEffect(() => { void load() }, [])
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Programme team members edit content and mark. Lead Validators only mark (until Lead Validator can be derived from validation history). Platform admins always can do both.</p>
      <ul className="space-y-1 text-sm">{staff.map((s) => <li key={s.email} className="flex flex-wrap items-center gap-2">{s.email} <Badge variant="outline">{s.role}</Badge><Button size="sm" variant="ghost" onClick={() => void training(`manage/staff/${encodeURIComponent(s.email)}`, { method: 'DELETE' }).then(load)}>Remove</Button></li>)}</ul>
      <form className="grid gap-2 sm:grid-cols-[1fr_12rem_auto] sm:items-end" onSubmit={async (e) => {
        e.preventDefault()
        try { await training(`manage/staff/${encodeURIComponent(n.email)}`, { method: 'PUT', json: { role: n.role } }); setN({ ...n, email: '' }); setMsg({ ok: true, text: 'Saved' }); void load() } catch (err: any) { setMsg({ ok: false, text: err.message }) }
      }}>
        <Input label="Email" type="email" required value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} />
        <label className="text-sm font-medium text-slate-700">Role<select value={n.role} onChange={(e) => setN({ ...n, role: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm font-normal"><option value="programme_team">Programme team</option><option value="lead_validator">Lead Validator</option></select></label>
        <Button type="submit" variant="outline">Add</Button>
      </form>
      <Note msg={msg} />
    </div>
  )
}
