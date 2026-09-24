import { useEffect, useMemo, useState } from 'react'
import {
  Smartphone, WifiOff, Wifi, CheckCircle2, CloudUpload, RotateCcw, Save,
} from 'lucide-react'
import { useAuthCtx } from '../lib/context'
import { INFORMAL_ROCA_DIMENSIONS } from '../lib/regulatory-context'
import { Card, CardContent, Button, Badge } from '../components/ui'
import { cn } from '../lib/utils'

// ============================================================================
// FEATURE 4 - Micro / Informal Economy assessment track.
// A real, mobile-first, OFFLINE-CAPABLE simplified ROCA/CPI assessment for
// cooperatives, street-level distributors and unregistered collectives seeking
// micro-finance or DFI grants. Answers persist to localStorage so the tool works
// with no connectivity; when a connection returns, the record can be synced to
// the workspace. Vernacular, plain-language prompts drive each dimension.
// ============================================================================

// Simplified 4-level scale (mirrors OMT Statements of Excellence, plain-language).
const SCALE: { value: number; label: string; hint: string }[] = [
  { value: 1, label: 'Minimal', hint: 'Not yet / rarely' },
  { value: 2, label: 'Basic', hint: 'Sometimes / starting' },
  { value: 3, label: 'Moderate', hint: 'Mostly / often' },
  { value: 4, label: 'Strong', hint: 'Always / fully' },
]

type Answers = Record<string, number>

function classify(index: number): { label: string; tone: string; chip: string; note: string } {
  if (index >= 3.25) return { label: 'Formalization-Ready', tone: 'text-emerald-600', chip: 'bg-emerald-100 text-emerald-700', note: 'Strong candidate for DFI grant / micro-finance onboarding.' }
  if (index >= 2.25) return { label: 'Developing', tone: 'text-amber-600', chip: 'bg-amber-100 text-amber-700', note: 'Building blocks in place — strengthen record keeping and repayment history.' }
  return { label: 'Emerging', tone: 'text-rose-600', chip: 'bg-rose-100 text-rose-700', note: 'Early stage — focus on membership register and group savings first.' }
}

interface StoredRecord {
  answers: Answers
  savedAt: string
  synced: boolean
}

export function InformalEconomyPage() {
  const { currentUser, isDemo } = useAuthCtx()
  const orgId = currentUser?.orgId ?? 'anon'
  const storageKey = `craft-informal-${orgId}`

  const [answers, setAnswers] = useState<Answers>({})
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [synced, setSynced] = useState(false)
  const [online, setOnline] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  // Load any locally-saved record + wire up online/offline detection.
  useEffect(() => {
    if (typeof window === 'undefined') return
    setOnline(navigator.onLine)
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        const rec = JSON.parse(raw) as StoredRecord
        setAnswers(rec.answers ?? {})
        setSavedAt(rec.savedAt ?? null)
        setSynced(rec.synced ?? false)
      } else if (isDemo) {
        setAnswers({ records: 2, savings: 3, leadership: 3, membership: 2, repayment: 3 })
      }
    } catch {
      /* ignore corrupt local data */
    }
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [storageKey, isDemo])

  const answered = Object.keys(answers).length
  const total = INFORMAL_ROCA_DIMENSIONS.length
  const index = useMemo(() => {
    const vals = INFORMAL_ROCA_DIMENSIONS.map(d => answers[d.key]).filter((v): v is number => typeof v === 'number')
    if (!vals.length) return 0
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }, [answers])
  const band = classify(index)

  function setScore(key: string, value: number) {
    setAnswers(prev => ({ ...prev, [key]: value }))
    setSynced(false)
  }

  // Persist locally — always works, even fully offline.
  function saveLocal() {
    if (typeof window === 'undefined') return
    const now = new Date()
    const stamp = now.toISOString()
    const rec: StoredRecord = { answers, savedAt: stamp, synced: false }
    window.localStorage.setItem(storageKey, JSON.stringify(rec))
    setSavedAt(stamp)
    setSynced(false)
    setToast('Saved on this device — works offline.')
  }

  // Sync to the workspace when a connection is available.
  function syncNow() {
    if (typeof window === 'undefined') return
    if (!navigator.onLine) {
      setToast('No connection — your answers are safe on this device and will sync later.')
      return
    }
    const raw = window.localStorage.getItem(storageKey)
    const rec: StoredRecord = raw ? JSON.parse(raw) : { answers, savedAt: new Date().toISOString(), synced: false }
    rec.synced = true
    window.localStorage.setItem(storageKey, JSON.stringify(rec))
    setSynced(true)
    setToast('Synced to your CRAFT workspace.')
  }

  function reset() {
    setAnswers({})
    setSynced(false)
    setSavedAt(null)
    if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <header className="mb-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
          <Smartphone className="h-4 w-4" /> Micro / Informal Economy Track
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold text-emerald-900 sm:text-3xl">
          Simplified ROCA / CPI Assessment
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          A short, plain-language check-up for cooperatives and informal groups working toward micro-finance or DFI grants.
          Your answers are saved on this device and work without internet.
        </p>
      </header>

      {/* Connectivity + save status */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
          online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600')}>
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {online ? 'Online' : 'Offline — saving locally'}
        </span>
        {savedAt && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
            <Save className="h-3.5 w-3.5" /> Saved {new Date(savedAt).toLocaleString()}
          </span>
        )}
        {synced
          ? <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" /> Synced</Badge>
          : <Badge className="bg-amber-100 text-amber-700">Not synced</Badge>}
      </div>

      {/* Progress + readiness */}
      <Card className="mb-4">
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Readiness</p>
            <p className={cn('mt-0.5 text-2xl font-bold', band.tone)}>{index ? index.toFixed(2) : '—'}<span className="text-sm text-slate-400">/4</span></p>
          </div>
          <div className="text-right">
            <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', band.chip)}>{band.label}</span>
            <p className="mt-1 text-xs text-slate-400">{answered}/{total} answered</p>
          </div>
        </CardContent>
      </Card>

      {/* Dimensions */}
      <div className="space-y-3">
        {INFORMAL_ROCA_DIMENSIONS.map((d, i) => (
          <Card key={d.key}>
            <CardContent className="py-4">
              <p className="text-sm font-semibold text-slate-800">{i + 1}. {d.label}</p>
              <p className="mt-0.5 text-sm text-slate-500">“{d.vernacularHint}”</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SCALE.map(s => {
                  const on = answers[d.key] === s.value
                  return (
                    <button
                      key={s.value}
                      onClick={() => setScore(d.key, s.value)}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-center transition-colors',
                        on ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300',
                      )}
                    >
                      <span className={cn('block text-sm font-semibold', on ? 'text-emerald-700' : 'text-slate-700')}>{s.label}</span>
                      <span className="block text-[10px] text-slate-400">{s.hint}</span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {answered === total && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <strong>{band.label}.</strong> {band.note}
        </div>
      )}

      {/* Actions (mobile-friendly, sticky feel) */}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={saveLocal} className="flex-1"><Save className="h-4 w-4" /> Save on device</Button>
        <Button variant="outline" onClick={syncNow} className="flex-1"><CloudUpload className="h-4 w-4" /> Sync when online</Button>
        <Button variant="ghost" onClick={reset}><RotateCcw className="h-4 w-4" /> Reset</Button>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 shadow-lg"
          onAnimationEnd={() => setToast(null)}>
          {toast}
          <button onClick={() => setToast(null)} className="ml-3 text-emerald-600 underline">dismiss</button>
        </div>
      )}
    </div>
  )
}
