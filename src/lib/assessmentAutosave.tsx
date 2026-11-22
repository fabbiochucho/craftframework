import { createContext, useCallback, useContext, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useAuthCtx } from './context'

export type FlushAssessment = () => Promise<boolean>
export const AssessmentAutosaveContext = createContext<((key: string, flush: FlushAssessment) => () => void) | null>(null)

export function useAssessmentAutosave<T>(options: {
  key: string; initial: T; enabled?: boolean
  validate: (value: T) => string | null
  write: (value: T) => Promise<{ savedAt?: string }>
  legacyDraft?: { storageKey: string; recordKey: string; convert: (value: unknown) => T }
}) {
  const { currentUser } = useAuthCtx()
  const enabled = options.enabled !== false
  const scope = `assessment-input:${currentUser?.email ?? ''}:${options.key}`
  const register = useContext(AssessmentAutosaveContext)
  const [value, setState] = useState(options.initial)
  const [status, setStatus] = useState('')
  const current = useRef(value)
  const dirty = useRef(false)
  const active = useRef(scope)
  active.current = scope
  const latest = useRef(options)
  latest.current = options
  const writes = useRef(Promise.resolve(true))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    current.current = options.initial
    dirty.current = false
    setState(options.initial)
    setStatus('')
    if (enabled) {
      try {
        let stored = localStorage.getItem(scope)
        if (!stored && options.legacyDraft && currentUser?.email) {
          const legacy = options.legacyDraft
          const entries = JSON.parse(localStorage.getItem(legacy.storageKey) ?? '{}')
          if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('The older assessment draft has an invalid format.')
          if (entries[legacy.recordKey] !== undefined) {
            stored = JSON.stringify(legacy.convert(entries[legacy.recordKey]))
            localStorage.setItem(scope, stored)
            delete entries[legacy.recordKey]
            localStorage.setItem(legacy.storageKey, JSON.stringify(entries))
          }
        }
        if (stored) { current.current = JSON.parse(stored); dirty.current = true; setState(current.current); setStatus('Restored unsaved input. Saving automatically when complete.') }
      } catch (error) { setStatus(`Could not restore the local draft: ${(error as Error).message}`) }
    }
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [scope, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current)
    if (!dirty.current) return writes.current
    if (latest.current.enabled === false) return false
    const snapshot = current.current
    const problem = latest.current.validate(snapshot)
    if (problem) { setStatus(problem); return false }
    const write = latest.current.write
    setStatus('Saving…')
    const request = writes.current.then(async () => {
      if (active.current !== scope) return false
      try {
        const result = await write(snapshot)
        if (active.current === scope && current.current === snapshot) {
          dirty.current = false
          try { localStorage.removeItem(scope) } catch (error) { setStatus(`Saved, but the local draft could not be cleared: ${(error as Error).message}`); return true }
          setStatus(result.savedAt ? `Saved ${new Date(result.savedAt).toLocaleString()}` : 'Saved.')
        }
        return true
      } catch (error) {
        if (active.current === scope) setStatus(`Not saved: ${(error as Error).message}. Your draft is kept on this device.`)
        return false
      }
    })
    writes.current = request
    return request
  }, [scope])

  const setValue: Dispatch<SetStateAction<T>> = useCallback(action => {
    if (!enabled) return
    const next = typeof action === 'function' ? (action as (previous: T) => T)(current.current) : action
    current.current = next
    dirty.current = true
    setState(next)
    setStatus('Not saved yet. Autosave pending.')
    try { localStorage.setItem(scope, JSON.stringify(next)) } catch (error) { setStatus(`Local draft storage failed: ${(error as Error).message}. Keep this page open until the save succeeds.`) }
  }, [enabled, scope])

  useEffect(() => {
    if (!enabled || !dirty.current) return
    timer.current = setTimeout(() => { void save() }, 3000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [value, enabled, save])
  useEffect(() => register?.(scope, save), [register, scope, save])
  return { value, setValue, save, status }
}
