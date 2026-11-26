import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button, Card, CardContent, Select } from './ui'
import { SIZE_BANDS } from '../lib/benchmarks'

// The organisation's own choice to appear (anonymously, in aggregates only) in the public CRAFT benchmarks. Off by default.
export function BenchmarkConsentCard({ orgId }: { orgId: string }) {
  const [state, setState] = useState<{ optedIn: boolean; sizeBand: string | null; canChange: boolean } | null>(null)
  const [size, setSize] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    fetch(`/api/benchmarks/consent?orgId=${encodeURIComponent(orgId)}`).then(async (r) => {
      if (!r.ok) return
      const s = await r.json()
      setState(s); setSize(s.sizeBand ?? '')
    }).catch(() => {})
  }, [orgId])
  if (!state) return null
  const change = async (optIn: boolean) => {
    const r = await fetch('/api/benchmarks/consent', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orgId, optIn, sizeBand: size || null }) })
    if (!r.ok) { setMessage((await r.json().catch(() => ({}))).error ?? 'Could not save your choice.'); return }
    setState({ ...state, optedIn: optIn, sizeBand: size || null })
    setMessage(optIn ? 'Thank you. Your results will be counted, anonymously, from the next nightly update.' : 'You have left the benchmarks. Your results are removed from the next nightly update.')
  }
  return (
    <Card><CardContent className="space-y-2 py-4 text-sm">
      <p className="font-semibold text-slate-800">Public benchmarks {state.optedIn && <span className="ml-1 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">taking part</span>}</p>
      <p className="text-slate-600">
        Help others see where organisations like yours stand. If you take part, your completed scores are counted in the{' '}
        <Link to="/benchmarks" className="text-emerald-700 underline">public benchmarks</Link> as part of groups of at least five. Your name, answers and evidence are never shown. You can leave at any time.
      </p>
      {state.canChange ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-48"><Select label="Staff size (optional)" placeholder="Not stated" value={size} onChange={setSize} options={SIZE_BANDS.map((b) => ({ value: b.id, label: b.label }))} /></div>
          {state.optedIn
            ? <><Button size="sm" variant="outline" onClick={() => void change(true)}>Update size</Button><Button size="sm" variant="outline" onClick={() => void change(false)}>Leave the benchmarks</Button></>
            : <Button size="sm" onClick={() => void change(true)}>Take part</Button>}
        </div>
      ) : <p className="text-xs text-slate-500">Only the organisation's own members can change this.</p>}
      {message && <p role="status" className="text-xs text-slate-600">{message}</p>}
    </CardContent></Card>
  )
}
