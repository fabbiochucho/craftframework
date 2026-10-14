import { useState } from 'react'
import { api, wsPath } from '../../lib/workspaceApi'
import { Badge, Button, Input, Select, Table, Tbody, Td, Th, Thead } from '../../components/ui'
import { ErrorLine, Header, State, useAction, useApi } from './shared'

const STATUS: Record<string, [string, string]> = {
  verified: ['bg-emerald-100 text-emerald-800', 'verified'], due: ['bg-amber-100 text-amber-800', 're-verification due'],
  changed: ['bg-rose-100 text-rose-800', 'changed — update needed'], unverified: ['bg-slate-200 text-slate-700', 'not yet verified'],
}

export function RegulatorySourcesPage({ workspaceId }: { workspaceId: string }) {
  const res = useApi<any>(wsPath(workspaceId, '/regulatory-sources'))
  const [flt, setFlt] = useState({ status: '', q: '' })
  const [form, setForm] = useState<{ key: string; outcome: string; note: string } | null>(null)
  const { run, error, busy } = useAction(res.reload)
  const rows = (res.data?.sources ?? []).filter((s: any) => (!flt.status || s.status === flt.status) && (!flt.q || s.country.toLowerCase().includes(flt.q.toLowerCase())))
  const count = (st: string) => res.data?.sources.filter((s: any) => s.status === st).length ?? 0
  return (
    <div className="space-y-6">
      <Header title="Regulatory sources" subtitle={`Re-verify the sources behind jurisdiction rules and country profiles before each reporting cycle (every ${res.data?.reverifyAfterDays ?? 365} days at least).`}
        back={{ to: '/app/workspaces/$workspaceId/dashboard', params: { workspaceId }, label: 'Dashboard' }} />
      <p className="text-sm text-slate-700">{count('unverified')} not yet verified · {count('due')} due · {count('changed')} changed · {count('verified')} verified</p>
      <div className="flex flex-wrap gap-3">
        <div className="w-56"><Select label="Status" placeholder="Any status" value={flt.status} onChange={status => setFlt({ ...flt, status })} options={Object.entries(STATUS).map(([value, [, label]]) => ({ value, label }))} /></div>
        <div className="w-56"><Input aria-label="Search country" placeholder="Search country" value={flt.q} onChange={e => setFlt({ ...flt, q: e.target.value })} /></div>
      </div>
      <ErrorLine error={error} /><State loading={res.loading} error={res.error} />
      <Table><Thead><tr><Th>Country</Th><Th>Source</Th><Th>To verify</Th><Th>Status</Th><Th>Last verified</Th><Th>Record a check</Th></tr></Thead>
        <Tbody>{rows.map((s: any) => (
          <tr key={s.key}>
            <Td>{s.country}</Td>
            <Td><a className="text-emerald-700 underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a></Td>
            <Td className="text-xs">{s.toVerify.join(', ') || '—'}</Td>
            <Td><Badge className={STATUS[s.status][0]}>{STATUS[s.status][1]}</Badge></Td>
            <Td className="text-xs">{s.lastVerified ?? '—'}{s.latestCheck && <div className="text-slate-500">{s.latestCheck.checkedBy}{s.latestCheck.note && `: ${s.latestCheck.note}`}</div>}</Td>
            <Td>{form && form.key === s.key ? (
              <div className="w-64 space-y-2">
                <Select label="Outcome" value={form.outcome} onChange={outcome => setForm(f => f && { ...f, outcome })} options={[{ value: 'confirmed', label: 'Confirmed unchanged' }, { value: 'changed', label: 'Changed' }, { value: 'unreachable', label: 'Source unreachable' }]} />
                <Input aria-label="Note" placeholder={form.outcome === 'confirmed' ? 'Note (optional)' : 'What changed / what you tried (required)'} value={form.note} onChange={e => setForm(f => f && { ...f, note: e.target.value })} />
                <div className="flex gap-2"><Button size="sm" disabled={busy || (form.outcome !== 'confirmed' && !form.note.trim())}
                  onClick={() => run(async () => { await api(wsPath(workspaceId, '/regulatory-sources/checks'), { method: 'POST', body: { sourceKey: s.key, outcome: form.outcome, note: form.note } }); setForm(null) })}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
              </div>) : <Button size="sm" variant="outline" onClick={() => setForm({ key: s.key, outcome: 'confirmed', note: '' })}>Record check</Button>}</Td>
          </tr>))}</Tbody></Table>
    </div>
  )
}
