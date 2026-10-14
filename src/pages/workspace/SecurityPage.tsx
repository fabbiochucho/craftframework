import { useState } from 'react'
import { api } from '../../lib/workspaceApi'
import { Button, Card, CardContent, Input } from '../../components/ui'
import { ErrorLine, Header, State, useAction, useApi } from './shared'

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-semibold text-amber-900">Save these recovery codes now. They are shown only once; each works once if you lose your phone.</p>
      <ul aria-label="Recovery codes" className="grid grid-cols-2 gap-1 font-mono text-sm">{codes.map(c => <li key={c}>{c}</li>)}</ul>
      <Button size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))}>Copy codes</Button>
    </div>
  )
}

export function SecurityPage() {
  const st = useApi<any>('/mfa/status')
  const [enrol, setEnrol] = useState<{ secret: string; otpauthUri: string; qrSvg: string } | null>(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const { run, error, busy } = useAction(st.reload)
  if (!st.data) return <State loading={st.loading} error={st.error} />
  const s = st.data
  return (
    <div className="max-w-2xl space-y-6">
      <Header title="Account security" subtitle="Multi-factor sign-in adds a code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy and similar) to your password." />
      {s.requiredBy.length > 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Required by: {s.requiredBy.map((o: any) => o.name).join(', ')}.</p>}
      <ErrorLine error={error} />
      {codes && <RecoveryCodes codes={codes} />}
      {!s.enabled && !enrol && <Card><CardContent className="space-y-3">
        <p className="text-sm">Multi-factor sign-in is <b>off</b>.</p>
        <Button disabled={busy} onClick={() => run(async () => setEnrol(await api('/mfa/enroll', { method: 'POST', body: {} })))}>Turn on multi-factor sign-in</Button>
      </CardContent></Card>}
      {!s.enabled && enrol && <Card><CardContent className="space-y-3">
        <p className="text-sm">1. Scan this code with your authenticator app, or enter the key manually.</p>
        <img src={enrol.qrSvg} alt="QR code for your authenticator app" width={200} height={200} className="rounded border border-slate-200" />
        <p className="text-sm">Key: <code className="break-all font-mono">{enrol.secret.match(/.{1,4}/g)?.join(' ')}</code></p>
        <p className="text-sm">On a phone, <a className="text-emerald-700 underline" href={enrol.otpauthUri}>open it in your authenticator app</a>.</p>
        <p className="text-sm">2. Enter the 6-digit code the app shows.</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void run(async () => { const r = await api('/mfa/enroll/confirm', { method: 'POST', body: { code } }); setCodes(r.recoveryCodes); setEnrol(null); setCode('') }) }}>
          <div className="w-48"><Input label="Authentication code" autoComplete="one-time-code" inputMode="numeric" value={code} onChange={e => setCode(e.target.value)} /></div>
          <Button type="submit" disabled={busy || !code}>Confirm and turn on</Button>
        </form>
      </CardContent></Card>}
      {s.enabled && <Card><CardContent className="space-y-3">
        <p className="text-sm">Multi-factor sign-in is <b>on</b>. {s.recoveryCodesLeft} recovery code(s) left.</p>
        <div className="w-48"><Input label="Current authentication code" autoComplete="one-time-code" inputMode="numeric" value={code} onChange={e => setCode(e.target.value)} /></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy || !code} onClick={() => run(async () => { const r = await api('/mfa/recovery-codes', { method: 'POST', body: { code } }); setCodes(r.recoveryCodes); setCode('') })}>New recovery codes</Button>
          <Button variant="destructive" disabled={busy || !code || s.requiredBy.length > 0} onClick={() => run(async () => { await api('/mfa/disable', { method: 'POST', body: { code } }); setCode(''); setCodes(null) })}>Turn off</Button>
        </div>
      </CardContent></Card>}
    </div>
  )
}
