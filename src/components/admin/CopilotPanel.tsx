import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '../ui'
import { TEMPLATE_KINDS } from '../../lib/copilot'

type Template = { id: number; title: string; kind: string; domains: string[]; keywords: string[]; archetypes: string[]; countries: string[]; body: string; source: string; status: string; createdBy: string; approvedBy: string | null }
type Question = { id: number; orgId: string; domainName: string; note: string; createdAt: string }

const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
const blank = { title: '', kind: 'sop', domains: '', keywords: '', archetypes: '', countries: '', body: '', source: '' }

// Admin → Copilot: curate the approved template library (a second curator approves each one) and answer questions the
// library did not cover. Only approved templates are ever given to the model.
export function CopilotPanel() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [queue, setQueue] = useState<Question[]>([])
  const [form, setForm] = useState(blank)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => {
    const [t, q] = await Promise.all([fetch('/api/copilot/templates'), fetch('/api/copilot/queue')])
    if (t.ok) setTemplates(await t.json())
    if (q.ok) setQueue(await q.json())
  }, [])
  useEffect(() => { void load() }, [load])
  const send = async (path: string, method: string, body?: unknown) => {
    const r = await fetch(`/api/copilot${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    const out = await r.json().catch(() => ({}))
    setMessage(r.ok ? 'Saved.' : out.error ?? 'Could not save.')
    if (r.ok) await load()
    return r.ok
  }
  const add = async () => {
    if (await send('/templates', 'POST', { ...form, domains: split(form.domains), keywords: split(form.keywords), archetypes: split(form.archetypes), countries: split(form.countries) })) setForm(blank)
  }
  return (
    <div className="space-y-6">
      {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
      <Card>
        <CardHeader><CardTitle>Questions for an expert ({queue.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!queue.length && <p className="text-sm text-slate-500">Nothing waiting. Questions arrive here when no approved template covers a gap.</p>}
          {queue.map((q) => (
            <div key={q.id} className="space-y-2 border-b pb-3 text-sm last:border-0">
              <p><b>{q.domainName}</b> · {q.orgId} · {new Date(q.createdAt).toLocaleDateString()}</p>
              {q.note && <p className="text-slate-600">{q.note}</p>}
              <Input label="Your answer" value={answers[q.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
              <Button size="sm" onClick={() => void send(`/queue/${q.id}/answer`, 'POST', { answer: answers[q.id] ?? '' })}>Send answer</Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Template library</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-slate-600">A template is used only after a second curator approves it. Editing sends it back for approval.</p>
          {templates.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0">
              <span className="font-medium">{t.title}</span>
              <Badge>{t.status}</Badge>
              <span className="text-xs text-slate-500">{t.domains.join(', ') || t.keywords.join(', ')} · by {t.createdBy}{t.approvedBy && ` · approved by ${t.approvedBy}`}</span>
              {t.status === 'draft' && <Button size="sm" variant="outline" onClick={() => void send(`/templates/${t.id}/approve`, 'POST')}>Approve</Button>}
              {t.status !== 'retired' && <Button size="sm" variant="outline" onClick={() => void send(`/templates/${t.id}/retire`, 'POST')}>Retire</Button>}
            </div>
          ))}
          <div className="grid gap-2 md:grid-cols-2">
            <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select label="Kind" value={form.kind} onChange={(kind) => setForm({ ...form, kind })} options={TEMPLATE_KINDS.map((k) => ({ value: k.id, label: k.label }))} />
            <Input label="Domain ids (comma-separated)" value={form.domains} onChange={(e) => setForm({ ...form, domains: e.target.value })} />
            <Input label="Keywords (comma-separated)" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
            <Input label="Organisation types (blank = any)" value={form.archetypes} onChange={(e) => setForm({ ...form, archetypes: e.target.value })} />
            <Input label="Countries, ISO-2 (blank = any)" value={form.countries} onChange={(e) => setForm({ ...form, countries: e.target.value })} />
            <Input label="Source and licence" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </div>
          <label className="block text-sm font-medium text-slate-700">Template text
            <textarea className="mt-1 h-48 w-full rounded border border-slate-300 p-2 font-mono text-xs" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </label>
          <Button size="sm" onClick={() => void add()}>Add template (draft)</Button>
        </CardContent>
      </Card>
    </div>
  )
}
