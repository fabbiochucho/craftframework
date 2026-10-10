import { useEffect, useRef, useState } from 'react'
import { Button, Input } from './ui'
import { changeFrameworkState, discardFailedFramework, openFrameworkWorkspace, readFrameworkState, resolveFrameworkConflict, retryFramework, saveFramework } from '../lib/offline/framework-store'
import { syncFrameworks } from '../lib/offline/framework-sync'
import { projectFrameworks, type FrameworkData, type FrameworkState } from '../lib/offline/framework-protocol'

const empty = (): FrameworkData => ({ name: '', description: '', questions: [], evidenceRefs: [] })

export function OfflineFrameworkEditor({ workspaceId }: { workspaceId: string }) {
  const [state, setState] = useState<FrameworkState | null>(null)
  const [role, setRole] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [editingVersion, setEditingVersion] = useState<number | undefined>()
  const [form, setForm] = useState(empty)
  const [questions, setQuestions] = useState('')
  const [refs, setRefs] = useState('')
  const generation = useRef(0)

  useEffect(() => {
    let active = true
    let scope: FrameworkState['scope'] | undefined
    let syncing = false
    const lock = () => {
      generation.current++
      scope = undefined
      if (active) { setState(null); setRole(''); setSelected(null); setForm(empty()); setQuestions(''); setRefs(''); setError(null) }
    }
    const load = async () => {
      const started = generation.current
      try {
        const result = await openFrameworkWorkspace(Number(workspaceId))
        if (!active || started !== generation.current) return
        scope = result.state.scope; setState(result.state); setRole(result.role); setError(null)
        await drain()
      } catch (cause) {
        if (active && started === generation.current) setError((cause as Error).message)
      }
    }
    const refresh = async () => {
      if (!scope) return
      const started = generation.current
      try {
        const next = await readFrameworkState(scope)
        if (active && started === generation.current) setState(next)
      } catch { if (started === generation.current) lock() }
    }
    const drain = async () => {
      if (!scope || syncing) return
      syncing = true
      try { await syncFrameworks(scope); await refresh() }
      catch (cause) { if (active) setError((cause as Error).message) }
      finally { syncing = false }
    }
    const session = () => { lock(); void load() }
    const online = () => { void load() }
    lock()
    void load()
    const timer = window.setInterval(() => { void drain(); void refresh() }, 5000)
    window.addEventListener('craft:session', session)
    window.addEventListener('craft:clear-sensitive', lock)
    window.addEventListener('craft:frameworks', refresh)
    window.addEventListener('online', online)
    return () => {
      active = false; window.clearInterval(timer)
      window.removeEventListener('craft:session', session)
      window.removeEventListener('craft:clear-sensitive', lock)
      window.removeEventListener('craft:frameworks', refresh)
      window.removeEventListener('online', online)
    }
  }, [workspaceId])

  const run = async (action: () => Promise<FrameworkState>) => {
    if (!state || busy) return
    setBusy(true); setError(null)
    const started = generation.current
    try {
      const next = await action()
      if (started !== generation.current) return
      setState(next)
      await syncFrameworks(next.scope)
      const refreshed = await readFrameworkState(next.scope)
      if (started === generation.current) setState(refreshed)
    } catch (cause) { if (started === generation.current) setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  const edit = (id: string | null, data: FrameworkData, version?: number) => {
    setSelected(id); setForm(data)
    setEditingVersion(version)
    setQuestions(data.questions.map(q => `${q.id} | ${q.domain} | ${q.text}`).join('\n'))
    setRefs(data.evidenceRefs.join(', '))
  }
  const save = () => run(async () => {
    const started = generation.current
    const data = { ...form, questions: questions.split('\n').filter(line => line.trim()).map(line => {
      const [id, domain, ...text] = line.split('|').map(part => part.trim())
      return { id, domain: domain ?? '', text: text.join(' | ') }
    }), evidenceRefs: refs.trim() ? refs.split(',').map(v => Number(v.trim())) : [] }
    const result = await saveFramework(state!.scope, selected ? 'update' : 'create', selected ?? crypto.randomUUID(), data, editingVersion)
    if (started === generation.current) edit(null, empty())
    return result
  })
  const writable = role === 'admin' || role === 'owner'
  const records = state ? projectFrameworks(state).filter(record => !record.deleted) : []
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    <h2 className="text-lg font-semibold">Custom framework editor</h2>
    <p className="text-sm text-slate-500">Explicit saves are encrypted on this device before upload. Pending edits survive reload and logout; only the original user can unlock them. Offline access requires opening this workspace online first. Evidence references must be existing IDs in this workspace; file bytes are not embedded.</p>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {!state ? <p className="text-sm text-slate-500">Framework storage locked or unavailable.</p> : <>
      <p role="status" className="text-sm">{state.pending.length} saved change(s) pending · workspace {state.scope.workspaceId} · organization {state.scope.orgId}</p>
      <ul className="space-y-2">{records.map(record => <li key={record.id} className="flex flex-wrap items-center gap-2 text-sm">
        <span className="flex-1">{record.data.name} · version {record.version} · {record.data.questions.length} questions</span>
        {writable && <><Button size="sm" disabled={busy} onClick={() => edit(record.id, record.data, record.version)}>Edit</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => saveFramework(state.scope, 'delete', record.id, undefined, record.version))}>Delete</Button></>}
      </li>)}</ul>
      {state.pending.filter(op => op.failure || op.error).map(op => <div key={op.operationId} className="space-y-2 rounded border border-amber-200 p-2 text-sm">
        <p>{op.failure ?? 'Waiting to retry'}: {op.error} · {op.frameworkId}</p>
        {writable && (op.failure === 'conflict' ? <>
          <p>Server: {op.serverRecord?.deleted ? 'deleted' : op.serverRecord?.data.name ?? 'missing'} · version {op.serverRecord?.version ?? 'none'}. Later local edits are blocked.</p>
          <Button size="sm" disabled={busy} onClick={() => run(() => resolveFrameworkConflict(state.scope, op.frameworkId, 'server'))}>Accept server (discard this local edit chain)</Button>
          <Button size="sm" disabled={busy || !op.serverRecord || op.serverRecord.deleted} onClick={() => run(() => resolveFrameworkConflict(state.scope, op.frameworkId, 'local'))}>Keep local (explicitly rebase this chain)</Button>
        </> : <><Button size="sm" disabled={busy} onClick={() => run(() => retryFramework(state.scope, op.frameworkId))}>Retry saved change</Button>
          {op.failure && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => discardFailedFramework(state.scope, op.frameworkId))}>Discard failed local chain (then edit again)</Button>}</>)}
      </div>)}
      {writable && <div className="space-y-3">
        <Input label="Framework name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <label className="block text-sm">Description<textarea className="mt-1 block w-full rounded border p-2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        <label className="block text-sm">Questions (one per line: ID | domain | question)<textarea className="mt-1 block w-full rounded border p-2" rows={4} value={questions} onChange={e => setQuestions(e.target.value)} /></label>
        <Input label="Evidence IDs (comma-separated)" value={refs} onChange={e => setRefs(e.target.value)} />
        <Button disabled={busy || !form.name.trim()} onClick={save}>{busy ? 'Saving…' : selected ? 'Save framework update' : 'Create framework'}</Button>
        {selected && <Button variant="outline" onClick={() => edit(null, empty())}>New framework</Button>}
      </div>}
      <Button variant="outline" disabled={busy} onClick={() => run(() => changeFrameworkState(state.scope, () => {}))}>Sync saved changes</Button>
    </>}
  </section>
}
