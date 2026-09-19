import { useMemo, useState } from 'react'
import { ScrollText, Search } from 'lucide-react'
import { AuditEntry } from '../lib/data'
import { useApp } from '../lib/context'
import { Card, CardContent, Input, Select, Table, Thead, Tbody, Th, Td, Badge } from '../components/ui'

const catColor: Record<AuditEntry['category'], string> = {
  Auth: 'bg-slate-100 text-slate-600',
  Assessment: 'bg-emerald-100 text-emerald-700',
  Evidence: 'bg-emerald-100 text-emerald-700',
  Config: 'bg-amber-100 text-amber-800',
  Export: 'bg-blue-100 text-blue-700',
}

export function AuditLogPage() {
  const { auditLog } = useApp()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('')

  const rows = useMemo(
    () =>
      auditLog.filter(e => {
        const q = !query || `${e.actor} ${e.action} ${e.target}`.toLowerCase().includes(query.toLowerCase())
        return q && (!cat || e.category === cat)
      }),
    [auditLog, query, cat],
  )

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
          <ScrollText className="h-4 w-4 text-emerald-600" /> Activity
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Audit Log</h1>
        <p className="mt-1 text-sm text-slate-500">
          Read-only, timestamped record of your workspace activity since your first sign-in.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search activity…" value={query} onChange={e => setQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="w-48">
          <Select
            placeholder="All categories"
            value={cat}
            onChange={setCat}
            options={['Auth', 'Assessment', 'Evidence', 'Config', 'Export'].map(c => ({ value: c, label: c }))}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table className="rounded-none border-0">
            <Thead>
              <tr>
                <Th>Timestamp</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Target</Th>
                <Th>Category</Th>
              </tr>
            </Thead>
            <Tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                    No activity recorded yet for this session.
                  </td>
                </tr>
              )}
              {rows.map(e => (
                <tr key={e.id}>
                  <Td><span className="font-mono text-xs text-slate-500">{e.timestamp}</span></Td>
                  <Td className="text-xs">{e.actor}</Td>
                  <Td className="text-sm font-medium text-slate-700">{e.action}</Td>
                  <Td className="text-xs text-slate-500">{e.target}</Td>
                  <Td><Badge className={catColor[e.category]}>{e.category}</Badge></Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
