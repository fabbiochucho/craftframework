import { createContext, useCallback, useContext, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useAuthCtx } from './context'
import { DraftUnreadable, readDraft, removeDraft, writeDraft } from './draftVault'

export type FlushAssessment = () => Promise<boolean>
export const AssessmentAutosaveContext = createContext<((key: string, flush: FlushAssessment) => () => void) | null>(null)

// A local draft remembers the saved value it was edited from ("base"). It is applied automatically only while the
// server still holds that value; otherwise someone saved since, and the draft waits for an explicit restore.
// Drafts are encrypted at rest (draftVault) and survive sign-out, readable only by the same person.
type Stored<T> = { __draft: 1; base: T; value: T }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function useAssessmentAutosave<T>(options: {
  key: string; initial: T; enabled?: boolean
  validate: (value: T) => string | null
  write: (value: T) => Promise<{ savedAt?: string }>
  legacyDraft?: { storageKey: string; recordKey: string; convert: (value: unknown) => T }
}) {
  const { currentUser } = useAuthCtx()
  const email = currentUser?.email ?? ''
  const enabled = options.enabled !== false
  const scope = `assessment-input:${email}:${options.key}`
  const conflictKey = `${scope}:conflict`
  const register = useContext(AssessmentAutosaveContext)
  const [value, setState] = useState(options.initial)
  const [status, setStatus] = useState('')
  const [conflict, setConflict] = useState(false)
  const current = useRef(value)
  const base = useRef(options.initial)
  const dirty = useRef(false)
  const active = useRef(scope)
  active.current = scope
  const latest = useRef(options)
  latest.current = options
  const writes = useRef(Promise.resolve(true))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persist = (next: T) => writeDraft(email, scope, { __draft: 1, base: base.current, value: next } satisfies Stored<T>)

  useEffect(() => {
    current.current = options.initial
    base.current = options.initial
    dirty.current = false
    setState(options.initial)
    setStatus('')
    setConflict(false)
    let cancelled = false
    if (enabled && email) void (async () => {
      try {
        let parsed = await readDraft<unknown>(email, scope)
        if (parsed === null && options.legacyDraft) {
          const legacy = options.legacyDraft
          const entries = JSON.parse(localStorage.getItem(legacy.storageKey) ?? '{}')
          if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('The older assessment draft has an invalid format.')
          if (entries[legacy.recordKey] !== undefined) {
            parsed = legacy.convert(entries[legacy.recordKey])
            await writeDraft(email, scope, parsed)
            delete entries[legacy.recordKey]
            localStorage.setItem(legacy.storageKey, JSON.stringify(entries))
          }
        }
        // Typing before the draft finished loading wins; the draft stays for the next visit.
        if (cancelled || dirty.current) return
        if (parsed !== null) {
          // Drafts written before the base was recorded have no base: treat them as possibly stale.
          const draft = (parsed as Stored<T>).__draft === 1 ? parsed as Stored<T> : { value: parsed as T }
          if (same(draft.value, options.initial)) await removeDraft(scope)
          else if ('base' in draft && same(draft.base, options.initial)) {
            current.current = draft.value; dirty.current = true; setState(draft.value)
            setStatus('Restored unsaved input. Saving automatically when complete.')
          } else {
            await writeDraft(email, conflictKey, draft.value)
            await removeDraft(scope)
          }
        }
        if (!cancelled && await readDraft(email, conflictKey) !== null) {
          setConflict(true)
          setStatus('This was saved elsewhere after your last unsaved change on this device, so the saved version is shown.')
        }
      } catch (error) {
        if (!cancelled && !(error instanceof DraftUnreadable)) setStatus(`Could not restore the local draft: ${(error as Error).message}`)
      }
    })()
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current) }
  }, [scope, enabled, email]) // eslint-disable-line react-hooks/exhaustive-deps

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
        if (active.current !== scope) return true
        base.current = snapshot
        if (current.current === snapshot) {
          dirty.current = false
          void removeDraft(scope)
          setStatus(result.savedAt ? `Saved ${new Date(result.savedAt).toLocaleString()}` : 'Saved.')
        } else {
          void persist(current.current).catch(() => { /* the newer edit is still in memory and autosave retries */ })
        }
        return true
      } catch (error) {
        if (active.current === scope) setStatus(`Not saved: ${(error as Error).message}. Your draft is kept on this device.`)
        return false
      }
    })
    writes.current = request
    return request
  }, [scope]) // eslint-disable-line react-hooks/exhaustive-deps

  const setValue: Dispatch<SetStateAction<T>> = useCallback(action => {
    if (!enabled) return
    const next = typeof action === 'function' ? (action as (previous: T) => T)(current.current) : action
    current.current = next
    dirty.current = true
    setState(next)
    setStatus('Not saved yet. Autosave pending.')
    persist(next).catch(error => { if (dirty.current) setStatus(`Not kept on this device: ${(error as Error).message} Keep this page open until the save succeeds.`) })
  }, [enabled, scope, email]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Replace the saved version with the unsaved one kept on this device; it then saves as usual. */
  const restoreLocal = useCallback(async () => {
    try {
      const kept = await readDraft<T>(email, conflictKey)
      if (kept !== null) setValue(kept)
      await removeDraft(conflictKey)
      setConflict(false)
    } catch (error) { setStatus(`Could not restore the local draft: ${(error as Error).message}`) }
  }, [conflictKey, setValue, email])
  const discardLocal = useCallback(() => {
    void removeDraft(conflictKey)
    setConflict(false)
    setStatus('')
  }, [conflictKey])

  useEffect(() => {
    if (!enabled || !dirty.current) return
    timer.current = setTimeout(() => { void save() }, 3000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [value, enabled, save])
  useEffect(() => register?.(scope, save), [register, scope, save])
  return { value, setValue, save, status, conflict, restoreLocal, discardLocal }
}

/** The save line under an autosaved field, with the choice to bring back an unsaved version that was superseded. */
export function AutosaveStatus({ draft, savedAt, label = 'Saved' }: {
  draft: { status: string; conflict: boolean; restoreLocal: () => unknown; discardLocal: () => void }
  savedAt?: string | null; label?: string
}) {
  const text = draft.status || (savedAt ? `${label} ${new Date(savedAt).toLocaleString()}` : '')
  if (!text && !draft.conflict) return null
  return (
    <div role="status" className="text-xs text-slate-600">
      {text}
      {draft.conflict && <>
        {' '}<button type="button" className="underline text-emerald-700" onClick={() => void draft.restoreLocal()}>Restore my unsaved version</button>
        {' · '}<button type="button" className="underline" onClick={draft.discardLocal}>Discard it</button>
      </>}
    </div>
  )
}
