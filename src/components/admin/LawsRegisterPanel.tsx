// Super Admin: what each law means for CRAFT itself, entries due for re-checking, and entries awaiting review.
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Table, Tbody, Td, Th, Thead } from '../ui'
import { buildInternalCheck } from '../../lib/laws/internalCheck'
import { LAW_DATA_VERSION, LAW_REGISTER } from '../../lib/laws/register'
import { jurisdictionName } from '../../lib/laws/types'

const STATUS_STYLE = { needed: 'bg-rose-100 text-rose-800', done: 'bg-emerald-100 text-emerald-800', 'n/a': 'bg-slate-100 text-slate-700' } as const

export function LawsRegisterPanel() {
  const check = useMemo(() => buildInternalCheck(LAW_REGISTER, new Date().toISOString().slice(0, 10)), [])
  const none = <p className="text-sm text-slate-500">None</p>
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">{LAW_DATA_VERSION} · {LAW_REGISTER.length} entries</p>
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
