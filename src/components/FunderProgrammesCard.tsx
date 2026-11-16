// Settings & Team, for funding-partner staff (and the Super Admin): the funder's own grants, report types and funding
// streams, one per line, which the organisations it funds then choose in Finance Triangulation.
import { useEffect, useState } from 'react'
import { Landmark } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from './ui'

type Item = { id: string; name: string }
type Programme = { id: string; name: string; grants: Item[]; reportTypes: Item[]; streams: Item[] }
const FIELDS = [
  { key: 'grants', label: 'Grants or projects', hint: 'For example: Youth TB Community Response 2025–2027' },
  { key: 'reportTypes', label: 'Report types', hint: 'For example: Quarterly financial report' },
  { key: 'streams', label: 'Funding streams or tranches (optional)', hint: 'For example: Core, Tranche 2' },
] as const
const lines = (xs: Item[]) => xs.map((x) => x.name).join('\n')
const field = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'

export function FunderProgrammesCard() {
  const [list, setList] = useState<Programme[]>([])
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [msg, setMsg] = useState<Record<string, string>>({})
  useEffect(() => {
    fetch('/api/funder-programmes?mine=1').then((r) => (r.ok ? r.json() : { programmes: [] })).then((d: { programmes: Programme[] }) => {
      setList(d.programmes)
      setDrafts(Object.fromEntries(d.programmes.map((p) => [p.id, { grants: lines(p.grants), reportTypes: lines(p.reportTypes), streams: lines(p.streams) }])))
    }, () => {})
  }, [])
  if (!list.length) return null
  const save = async (id: string) => {
    const d = drafts[id]
    const split = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
    const res = await fetch('/api/funder-programmes', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ firmId: id, grants: split(d.grants), reportTypes: split(d.reportTypes), streams: split(d.streams) }) })
    const body = await res.json().catch(() => null)
    setMsg({ ...msg, [id]: res.ok ? 'Saved. Organisations can now choose these in Finance Triangulation.' : body?.error ?? 'Could not save.' })
  }
  return (
    <>
      {list.map((p) => (
        <Card key={p.id}>
          <CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="h-4 w-4" /> {p.name}: grants and report types</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500">One per line. Organisations on CRAFT see these names when they choose a funder for a finance report, so use names you are happy for them to see.</p>
            {FIELDS.map((f) => (
              <label key={f.key} className="block text-xs font-medium text-slate-600">{f.label}
                <textarea rows={3} className={field} placeholder={f.hint} value={drafts[p.id]?.[f.key] ?? ''}
                  onChange={(e) => setDrafts({ ...drafts, [p.id]: { ...drafts[p.id], [f.key]: e.target.value } })} />
              </label>
            ))}
            <div className="flex items-center gap-3">
              <Button onClick={() => void save(p.id)}>Save</Button>
              {msg[p.id] && <p role="status" className="text-sm text-slate-600">{msg[p.id]}</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  )
}
