import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '../lib/utils'
import { useApp } from '../lib/context'

// Subtle vault session countdown shown bottom-right of the secure workspace.
// The window is driven by the user's security-bounded session-timeout
// preference (5–60 minutes). Any activity resets the countdown, and the badge
// shifts colour as the remaining time runs low.
export function SessionTimer() {
  const { sessionTimeout } = useApp()
  const total = sessionTimeout * 60
  const [seconds, setSeconds] = useState(total)

  // Re-arm the countdown whenever the preferred timeout changes.
  useEffect(() => {
    setSeconds(sessionTimeout * 60)
  }, [sessionTimeout])

  // Reset the countdown on any user activity, mirroring an idle-timeout policy.
  useEffect(() => {
    const reset = () => setSeconds(sessionTimeout * 60)
    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, reset))
  }, [sessionTimeout])

  useEffect(() => {
    const id = setInterval(() => setSeconds(s => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  // Colour tiers: emerald > 5 min, amber < 5 min, rose < 1 min.
  const critical = seconds <= 60
  const warning = !critical && seconds <= 300

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur',
        critical
          ? 'border-rose-300 bg-rose-50/90 text-rose-700'
          : warning
            ? 'border-amber-300 bg-amber-50/90 text-amber-700'
            : 'border-emerald-300 bg-emerald-50/90 text-emerald-700',
      )}
      title={`Idle session timeout: ${sessionTimeout} minutes`}
    >
      <Lock className={cn('h-3 w-3', critical && 'animate-craft-pulse')} />
      <span className="font-mono tabular-nums">
        Session expires in {mm}:{ss}
      </span>
    </div>
  )
}
