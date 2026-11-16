// Settings & Team: the organisation names its finance officer (prepares the figures) and grant manager (reviews them)
// for Finance Triangulation. They must be different people; the role adds to their normal access.
import { useEffect, useState } from 'react'
import { Banknote } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Input, Button } from './ui'
import { fetchFinanceRoles, saveFinanceRole, type FinanceRoles } from '../lib/api'

const ROLES = [
  { key: 'org_finance_officer', label: 'Finance officer', hint: 'Enters opening balances, income, spending and the bank balance' },
  { key: 'org_grant_manager', label: 'Grant manager', hint: "Reviews the finance officer's figures and passes them to the independent assessor" },
] as const

export function FinanceRolesCard({ orgId }: { orgId: string }) {
  const [named, setNamed] = useState<FinanceRoles['named'] | null>(null)
  const [draft, setDraft] = useState({ org_finance_officer: '', org_grant_manager: '' })
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (!orgId) return
    fetchFinanceRoles(orgId).then((r) => { setNamed(r.named); setDraft(r.named) }, () => setMsg('Finance roles could not be loaded.'))
  }, [orgId])
  const save = async (role: (typeof ROLES)[number]['key']) => {
    setMsg('')
    try {
      const next = await saveFinanceRole(orgId, role, draft[role].trim())
      setNamed(next); setDraft(next); setMsg('Saved.')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not save.')
    }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="h-4 w-4" /> Finance roles</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500">Who takes part in Finance Triangulation. Use two different people; the role is added to their normal access. Your independent assessor verifies and locks each report.</p>
        {named && ROLES.map((r) => (
          <div key={r.key} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem] flex-1">
              <Input label={r.label} type="email" placeholder="name@organisation.org" value={draft[r.key]} onChange={(e) => setDraft({ ...draft, [r.key]: e.target.value })} />
              <p className="mt-1 text-xs text-slate-500">{r.hint}</p>
            </div>
            <Button variant="outline" disabled={draft[r.key].trim() === named[r.key]} onClick={() => void save(r.key)}>
              {draft[r.key].trim() ? 'Save' : 'Clear'}
            </Button>
          </div>
        ))}
        {msg && <p role="status" className="text-sm text-slate-600">{msg}</p>}
      </CardContent>
    </Card>
  )
}
