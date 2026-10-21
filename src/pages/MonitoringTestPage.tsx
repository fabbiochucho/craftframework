import { useState } from 'react'
import { useAuthCtx } from '../lib/context'
import { isSuperAdminEmail } from '../lib/data'
import { monitoringConfigured, sendBrowserTestError } from '../lib/monitoring'
import { Button, Card, CardContent, CardHeader, CardTitle } from '../components/ui'

function Crash(): never {
  throw new Error('Sentry render test error (deliberate, triggered by a Super Admin)')
}

/** Super Admin only: sends a deliberate error from the browser, from a function, or from a render, to confirm monitoring end to end. */
export function MonitoringTestPage() {
  const { currentUser } = useAuthCtx()
  const [crash, setCrash] = useState(false)
  const [status, setStatus] = useState('')

  if (!isSuperAdminEmail(currentUser?.email)) {
    return <main className="mx-auto max-w-2xl p-6"><p className="text-sm text-slate-600">This page is for the platform Super Admin.</p></main>
  }
  if (crash) return <Crash />

  const server = async () => {
    setStatus('Sending…')
    try {
      const res = await fetch('/api/monitoring-test', { method: 'POST', cache: 'no-store' })
      const body = await res.json().catch(() => ({}))
      setStatus(!res.ok ? `Server refused (${res.status})` : body.sent ? 'Server test error sent.' : 'The function has no SENTRY_DSN, so nothing was sent.')
    } catch { setStatus('Could not reach the server.') }
  }
  const browser = async () => setStatus((await sendBrowserTestError()) ? 'Browser test error sent.' : 'This build has no VITE_SENTRY_DSN, so nothing was sent.')

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader><CardTitle>Error monitoring test</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Each button sends one deliberate, labelled error to Sentry (EU). Nothing about you or this page's data is attached.
            Browser monitoring is {monitoringConfigured ? 'configured' : 'not configured (no VITE_SENTRY_DSN)'}.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={browser}>Send browser test error</Button>
            <Button onClick={server}>Send server test error</Button>
            <Button variant="outline" onClick={() => setCrash(true)}>Crash this page (shows the fallback)</Button>
          </div>
          <p role="status" className="text-sm text-slate-700">{status}</p>
        </CardContent>
      </Card>
    </main>
  )
}
