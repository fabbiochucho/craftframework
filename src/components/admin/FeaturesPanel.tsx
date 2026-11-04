// Super Admin: switch parts of CRAFT off (or back on) for everyone, an organisation type, a country, a network, an
// organisation or one user. Rules (src/lib/features.ts): off for everyone wins over everything; otherwise the most
// specific setting wins; when an organisation's networks disagree, off wins. Switching off never deletes data.
import { useCallback, useEffect, useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../ui'
import { featureAdmin as api } from '../../lib/api'
import { cn } from '../../lib/utils'
import { SCOPE_LABEL, SCOPES, type Decision, type Scope } from '../../lib/features'

type FeatureRow = { key: string; label: string; description: string }
type SwitchRow = { feature: string; scope: Scope; scopeId: string; enabled: boolean; reason: string; setBy: string; setAt: string; expiresAt: string | null }
type Admin = { features: FeatureRow[]; switches: SwitchRow[]; options: { archetype: string[]; country: string[]; network: { id: string; name: string }[] } }

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })

export function FeaturesPanel() {
  const [data, setData] = useState<Admin | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { try { setData(await api<Admin>('admin')); setError(null) } catch (e) { setError((e as Error).message) } }, [])
  useEffect(() => { void load() }, [load])
  if (!data) return <p className="text-sm text-slate-500" role={error ? 'alert' : 'status'}>{error ?? 'Loading…'}</p>

  const netName = (id: string) => data.options.network.find((n) => n.id === id)?.name ?? id
  const target = (s: SwitchRow) => s.scope === 'global' ? 'Everyone' : `${SCOPE_LABEL[s.scope]}: ${s.scope === 'network' ? netName(s.scopeId) : s.scopeId}`
  const remove = async (s: SwitchRow) => {
    try { await api('admin', { method: 'DELETE', body: { feature: s.feature, scope: s.scope, scopeId: s.scopeId } }); await load() } catch (e) { setError((e as Error).message) }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Switch a feature off for everyone, an organisation type, a country, a network, an organisation or one user. <b>Off for everyone</b> wins over every other setting; otherwise the most specific setting wins, and when an organisation's networks disagree, off wins. Data is never deleted, and changes reach everyone within a minute. You (Super Admin) always keep every feature, so use <b>Check as</b> to see what someone else sees.
      </p>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <SetSwitch data={data} onSaved={load} />

      <Card>
        <CardHeader><CardTitle>Features</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-slate-100">
            {data.features.map((f) => {
              const mine = data.switches.filter((s) => s.feature === f.key)
              const killed = mine.some((s) => s.scope === 'global' && !s.enabled && (!s.expiresAt || new Date(s.expiresAt) > new Date()))
              return (
                <li key={f.key} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{f.label}</span>
                    <span className={cn('rounded px-1.5 py-0.5 text-xs font-semibold', killed ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800')}>{killed ? 'Off for everyone' : 'On'}</span>
                    {mine.length > 0 && <span className="text-xs text-slate-500">{mine.length} setting{mine.length === 1 ? '' : 's'}</span>}
                  </div>
                  <p className="text-xs text-slate-500">{f.description}</p>
                  {mine.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {mine.map((s) => (
                        <li key={`${s.scope}:${s.scopeId}`} className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={cn('rounded px-1.5 py-0.5 font-semibold', s.enabled ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800')}>{s.enabled ? 'On' : 'Off'}</span>
                          <span className="text-slate-800">{target(s)}</span>
                          <span className="text-slate-500">— {s.reason} · {s.setBy}, {day(s.setAt)}{s.expiresAt && ` · until ${day(s.expiresAt)}`}</span>
                          <button type="button" onClick={() => void remove(s)} className="font-semibold text-rose-700 hover:underline">Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <CheckAs features={data.features} netName={netName} />
    </div>
  )
}

function SetSwitch({ data, onSaved }: { data: Admin; onSaved: () => void }) {
  const [f, setF] = useState({ feature: data.features[0]?.key ?? '', scope: 'global' as Scope, scopeId: '', enabled: 'off', reason: '', until: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const pickList = f.scope === 'archetype' ? data.options.archetype.map((v) => ({ value: v, label: v }))
    : f.scope === 'country' ? data.options.country.map((v) => ({ value: v, label: v }))
    : f.scope === 'network' ? data.options.network.map((n) => ({ value: n.id, label: n.name })) : null
  const save = async () => {
    setBusy(true); setMessage(null)
    try {
      await api('admin', { method: 'PUT', body: {
        feature: f.feature, scope: f.scope, scopeId: f.scope === 'global' ? '' : f.scopeId.trim(), enabled: f.enabled === 'on', reason: f.reason,
        expiresAt: f.until ? new Date(`${f.until}T23:59:59`).toISOString() : null,
      } })
      setMessage('Saved.'); setF({ ...f, reason: '', scopeId: f.scope === 'global' ? '' : f.scopeId }); onSaved()
    } catch (e) { setMessage((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Switch a feature on or off</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="Feature" value={f.feature} onChange={(feature) => setF({ ...f, feature })} options={data.features.map((x) => ({ value: x.key, label: x.label }))} />
          <Select label="For" value={f.scope} onChange={(scope) => setF({ ...f, scope: scope as Scope, scopeId: '' })} options={SCOPES.map((s) => ({ value: s, label: SCOPE_LABEL[s] }))} />
          {f.scope === 'global' ? <div />
            : pickList ? <Select label={SCOPE_LABEL[f.scope]} value={f.scopeId} onChange={(scopeId) => setF({ ...f, scopeId })} placeholder={pickList.length ? 'Choose…' : 'None yet'} options={pickList} />
            : <Input label={f.scope === 'user' ? 'User email' : 'Organisation id'} value={f.scopeId} onChange={(e) => setF({ ...f, scopeId: e.target.value })} placeholder={f.scope === 'user' ? 'name@org.example' : 'e.g. self_owner_acme_example'} />}
        </div>
        <div className="grid gap-3 sm:grid-cols-[140px_1fr_180px]">
          <Select label="Set to" value={f.enabled} onChange={(enabled) => setF({ ...f, enabled })} options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]} />
          <Input label="Reason (shown to people when it's off)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <Input label="Until (optional)" type="date" value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy || f.reason.trim().length < 3 || (f.scope !== 'global' && !f.scopeId.trim())}>Save setting</Button>
          {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function CheckAs({ features, netName }: { features: FeatureRow[]; netName: (id: string) => string }) {
  const [q, setQ] = useState('')
  const [result, setResult] = useState<{ who: { email: string; orgId: string; archetype: string; country: string; networkIds: string[] }; decisions: Record<string, Decision> } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const check = async () => {
    setError(null)
    const v = q.trim()
    try { setResult(await api(`check?${v.includes('@') ? 'email' : 'orgId'}=${encodeURIComponent(v)}`)) } catch (e) { setError((e as Error).message) }
  }
  const rule = (d: Decision) => d.scope === 'default' ? 'no setting' : d.scope === 'global' ? 'everyone' : `${SCOPE_LABEL[d.scope]}: ${d.scope === 'network' ? netName(d.scopeId) : d.scopeId}`
  return (
    <Card>
      <CardHeader><CardTitle>Check as</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-64 flex-1"><Input label="User email or organisation id" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Button variant="outline" onClick={check} disabled={!q.trim()}>Check</Button>
        </div>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {result && (
          <>
            <p className="text-xs text-slate-500">
              Organisation {result.who.orgId || '(none)'} · type {result.who.archetype || '(not set)'} · country {result.who.country || '(not set)'} · networks {result.who.networkIds.map(netName).join(', ') || '(none)'}
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {features.map((f) => {
                const d = result.decisions[f.key]
                return (
                  <li key={f.key} className="flex items-center gap-2 text-sm">
                    <span className={cn('w-10 rounded px-1.5 py-0.5 text-center text-xs font-semibold', d.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}>{d.enabled ? 'On' : 'Off'}</span>
                    <span className="text-slate-800">{f.label}</span>
                    <span className="text-xs text-slate-500">({rule(d)})</span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
