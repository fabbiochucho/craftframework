// Super Admin: what each law means for CRAFT itself, entries due for re-checking, and entries awaiting review.
import { useMemo, useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Table, Tbody, Td, Th, Thead } from '../ui'
import { setLawApproval } from '../../lib/api'
import { useLawApprovals } from '../../lib/laws/useLawApprovals'
import { buildInternalCheck } from '../../lib/laws/internalCheck'
import { LAW_DATA_VERSION, LAW_REGISTER } from '../../lib/laws/register'
import { jurisdictionName } from '../../lib/laws/types'

const STATUS_STYLE = { needed: 'bg-rose-100 text-rose-800', done: 'bg-emerald-100 text-emerald-800', 'n/a': 'bg-slate-100 text-slate-700' } as const

export function LawsRegisterPanel() {
  const { records, approved, reload } = useLawApprovals()
  const check = useMemo(() => buildInternalCheck(LAW_REGISTER, new Date().toISOString().slice(0, 10), approved), [approved.join()])
  const none = <p className="text-sm text-slate-500">None</p>
  const jurisdictions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of LAW_REGISTER) counts.set(e.jurisdiction, (counts.get(e.jurisdiction) ?? 0) + 1)
    return [...counts].map(([id, n]) => ({ id, n })).sort((a, b) => jurisdictionName(a.id).localeCompare(jurisdictionName(b.id)))
  }, [])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const change = async (id: string, approve: boolean) => {
    setBusy(id); setError(null)
    try { await setLawApproval(id, approve, LAW_DATA_VERSION); reload() } catch (e) { setError(`${jurisdictionName(id)}: ${(e as Error).message}`) } finally { setBusy(null) }
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">{LAW_DATA_VERSION} · {LAW_REGISTER.length} entries · {approved.length} of {jurisdictions.length} jurisdictions approved</p>
      <Card>
        <CardHeader><CardTitle>Approve jurisdictions for organisation reports</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">Approve a jurisdiction only after its entries in the internal review document have been checked against their sources. All of its entries are approved together.</p>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <Table><Thead><tr><Th>Jurisdiction</Th><Th>Entries</Th><Th>Status</Th><Th>Action</Th></tr></Thead>
            <Tbody>{jurisdictions.map(({ id, n }) => {
              const r = records.find((x) => x.jurisdiction === id)
              return (
                <tr key={id}>
                  <Td>{jurisdictionName(id)} ({id})</Td><Td>{n}</Td>
                  <Td>{!r ? <span className="text-xs text-slate-500">Pending review</span>
                    : r.registerVersion !== LAW_DATA_VERSION ? <span className="text-xs text-amber-700">Needs re-approval: approved for {r.registerVersion}; the register has changed since</span>
                    : <span className="text-xs text-emerald-800">Approved{r.approvedBy ? ` by ${r.approvedBy}` : ''} · {new Date(r.approvedAt).toLocaleDateString()}</span>}</Td>
                  <Td className="space-x-1">
                    {(!r || r.registerVersion !== LAW_DATA_VERSION) && <Button size="sm" disabled={busy === id} onClick={() => void change(id, true)}>{r ? 'Re-approve' : 'Approve'}</Button>}
                    {r && <Button size="sm" variant="outline" disabled={busy === id} onClick={() => void change(id, false)}>Revoke</Button>}
                  </Td>
                </tr>
              )
            })}</Tbody></Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>What CRAFT must do</CardTitle></CardHeader>
        <CardContent>{check.duties.length === 0 ? none : (
          <Table><Thead><tr><Th>Jurisdiction</Th><Th>Law</Th><Th>Duty</Th><Th>Note</Th><Th>Status</Th></tr></Thead>
            <Tbody>{check.duties.map((d, i) => (
              <tr key={i}><Td>{d.jurisdiction}</Td><Td>{d.law}</Td><Td>{d.duty}</Td><Td>{d.note}</Td>
                <Td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[d.status]}`}>{d.status}</span></Td></tr>
            ))}</Tbody></Table>
        )}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Re-check due (source checked over 12 months ago)</CardTitle></CardHeader>
        <CardContent>{check.recheckDue.length === 0 ? none : (
          <Table><Thead><tr><Th>Jurisdiction</Th><Th>Law</Th><Th>Checked</Th></tr></Thead>
            <Tbody>{check.recheckDue.map(e => <tr key={e.id}><Td>{jurisdictionName(e.jurisdiction)}</Td><Td>{e.title}</Td><Td>{e.source.checked}</Td></tr>)}</Tbody></Table>
        )}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Awaiting review (not shown to organisations)</CardTitle></CardHeader>
        <CardContent>{check.pending.length === 0 ? none : (
          <Table><Thead><tr><Th>Jurisdiction</Th><Th>Entries</Th></tr></Thead>
            <Tbody>{check.pending.map(p => <tr key={p.jurisdiction}><Td>{jurisdictionName(p.jurisdiction)}</Td><Td>{p.count}</Td></tr>)}</Tbody></Table>
        )}</CardContent>
      </Card>
    </div>
  )
}
