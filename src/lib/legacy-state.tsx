import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { fetchLegacyState, saveLegacyState } from './api'

export type SaveStatus = 'loading' | 'ready' | 'saving' | 'saved' | 'error' | 'demo' | 'read-only'

export function usePersistedTenantState<T>(
  orgId: string | undefined, demo: boolean, key: string, initial: T | (() => T), readOnly = false,
): [T, Dispatch<SetStateAction<T>>, SaveStatus] {
  const initialRef = useRef(initial)
  initialRef.current = initial
  const fresh = useCallback(() => typeof initialRef.current === 'function'
    ? (initialRef.current as () => T)() : initialRef.current, [])
  const [value, setValue] = useState<T>(fresh)
  const [status, setStatus] = useState<SaveStatus>('loading')
  const current = useRef(value)
  const generation = useRef(0)
  const edited = useRef(false)
  const writes = useRef(Promise.resolve())
  useEffect(() => {
    const gen = ++generation.current
    edited.current = false
    current.current = fresh()
    setValue(current.current)
    setStatus(demo ? 'demo' : readOnly ? 'read-only' : 'loading')
    if (!orgId || demo) return
    void fetchLegacyState<T>(orgId, key).then(saved => {
      if (generation.current !== gen || edited.current) return
      if (saved !== null) { current.current = saved; setValue(saved) }
      setStatus(readOnly ? 'read-only' : 'ready')
    }).catch(() => { if (generation.current === gen) setStatus('error') })
    return () => { ++generation.current }
  }, [orgId, demo, key, readOnly, fresh])

  const update: Dispatch<SetStateAction<T>> = useCallback(action => {
    if (readOnly || (!demo && !orgId)) return
    // Never replace unknown server state after a failed/incomplete initial read.
    if (!demo && !edited.current && status !== 'ready' && status !== 'saved') return
    const next = typeof action === 'function' ? (action as (prev: T) => T)(current.current) : action
    current.current = next
    edited.current = true
    setValue(next)
    if (demo || !orgId) return
    const gen = generation.current
    setStatus('saving')
    writes.current = writes.current.catch(() => {}).then(async () => {
      if (generation.current !== gen) return
      try {
        await saveLegacyState(orgId, key, next)
        if (generation.current === gen && current.current === next) setStatus('saved')
      } catch {
        if (generation.current === gen) setStatus('error')
      }
    })
  }, [orgId, demo, key, readOnly, status])
  return [value, update, status]
}

export function LegacySaveStatus({ status }: { status: SaveStatus }) {
  const label = {
    loading: 'Loading saved assessment — editing will be available when loaded.',
    ready: 'Assessment loaded. Changes save to your workspace.',
    saving: 'Saving to workspace…',
    saved: 'Saved to workspace.',
    error: 'Could not load or save. Unsaved changes are not durable; reconnect and retry before leaving.',
    demo: 'Illustrative demo — changes are not saved.',
    'read-only': 'Client workspace — read-only.',
  }[status]
  return <p role="status" className={status === 'error' ? 'text-sm text-rose-700' : 'text-xs text-slate-500'}>{label}</p>
}
