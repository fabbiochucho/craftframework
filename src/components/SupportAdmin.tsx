import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Award, FolderOpen, Handshake, LifeBuoy, Search } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from './ui'
import { BadgeChip } from './AmbassadorBadges'
import type { Badge as AmbassadorBadge } from '../lib/ambassadors'

// Super Admin tools: support an organisation directly (open its Evidence registry, answer its evidence
// requests) and see referrals / ambassadors across the platform.

type Found = {
  workspaceOrganisations: Array<{ id: number; name: string; country: string; contactEmail: string; documents: number; workspaces: Array<{ id: number; name: string }> }>
  organisations: Array<{ id: string; name: string; email: string; country: string; openEvidenceRequests: number; engagements: Array<{ id: string; type: string }> }>
}

export function SupportFinder() {
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Found | null>(null)
  const [error, setError] = useState('')
  const search = async () => {
    setError('')
    try {
      const r = await fetch(`/api/support/orgs?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' })
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `Request failed (${r.status})`)
      setFound(await r.json())
    } catch (e) { setError((e as Error).message) }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><LifeBuoy className="h-4 w-4 text-emerald-600" /> Support an organisation</CardTitle>
        <p className="text-sm text-slate-500">
          Act on an organisation's behalf: add documents to its Evidence registry or answer its evidence requests. Everything you do is
          labelled <strong>Added by CRAFT support</strong>, emailed to the organisation's contacts and administrators, and audit-logged.
          The organisation can remove anything you add.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void search() }}>
          <div className="min-w-[16rem] flex-1"><Input label="Organisation name or contact email" value={q} onChange={(e) => setQ(e.target.value)} placeholder="NYNETHA" /></div>
          <Button type="submit" disabled={q.trim().length < 2}><Search className="h-4 w-4" /> Find</Button>
        </form>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {found && !found.workspaceOrganisations.length && !found.organisations.length && <p className="text-sm text-slate-500">No organisation matches.</p>}
        {found && found.workspaceOrganisations.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence registries</p>
            <ul className="divide-y divide-slate-100">
              {found.workspaceOrganisations.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="font-medium text-slate-900">{o.name}</span>
                  <span className="text-xs text-slate-500">{[o.country, o.contactEmail, `${o.documents} document${o.documents === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</span>
                  <span className="ml-auto flex flex-wrap gap-2">
                    {o.workspaces.map((w) => (
                      <Link key={w.id} to="/app/workspaces/$workspaceId/evidence" params={{ workspaceId: String(w.id) }}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">
                        <FolderOpen className="h-3.5 w-3.5" /> {w.name}: Evidence registry
                      </Link>
                    ))}
                    {!o.workspaces.length && <span className="text-xs text-slate-400">No workspace yet</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {found && found.organisations.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Engagements and evidence requests</p>
            <ul className="divide-y divide-slate-100">
              {found.organisations.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="font-medium text-slate-900">{o.name}</span>
                  <span className="text-xs text-slate-500">{[o.country, o.email].filter(Boolean).join(' · ')}</span>
                  {o.openEvidenceRequests > 0 && <Badge className="bg-amber-100 text-amber-800">{o.openEvidenceRequests} evidence request{o.openEvidenceRequests === 1 ? '' : 's'} open</Badge>}
                  <span className="ml-auto flex flex-wrap gap-2">
                    {o.engagements.map((e) => (
                      <Link key={e.id} to="/engagements/$id" params={{ id: e.id }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        <Handshake className="h-3.5 w-3.5" /> {e.type === 'funder_review' ? 'Funder review' : 'Independent validation'}
                      </Link>
                    ))}
                    {!o.engagements.length && <span className="text-xs text-slate-400">No active engagement</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type Overview = {
  funnel: { invited: number; joined: number; started: number; assessed: number }
  byLink: Record<string, { invited: number; joined: number; started: number; assessed: number }>
  ambassadors: Array<{ inviter: string; invited: number; joined: number; started: number; assessed: number; badges: AmbassadorBadge[] }>
}

export function ReferralsOverview() {
  const [d, setD] = useState<Overview | null>(null)
  useEffect(() => { void fetch('/api/referrals/overview', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setD, () => {}) }, [])
  if (!d) return null
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Award className="h-4 w-4 text-amber-600" /> Referrals & ambassadors</CardTitle>
        <p className="text-sm text-slate-500">Organisations brought to CRAFT by email invitation, and who brought them. Badges count organisations that started their assessment.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b text-xs text-slate-500"><th className="py-2 pr-3">Through</th><th className="pr-3">Invited</th><th className="pr-3">Joined</th><th className="pr-3">Started assessment</th><th>Completed one</th></tr></thead>
            <tbody>
              {[['All', d.funnel] as const, ...Object.entries(d.byLink).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), v] as const)].map(([label, f]) => (
                <tr key={label} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium">{label}</td><td className="pr-3">{f.invited}</td>
                  <td className="pr-3">{f.joined} <span className="text-xs text-slate-400">{pct(f.joined, f.invited)}</span></td>
                  <td className="pr-3">{f.started} <span className="text-xs text-slate-400">{pct(f.started, f.invited)}</span></td>
                  <td>{f.assessed} <span className="text-xs text-slate-400">{pct(f.assessed, f.invited)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.ambassadors.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {d.ambassadors.slice(0, 25).map((a) => (
              <li key={a.inviter} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-medium text-slate-900">{a.inviter}</span>
                <span className="text-xs text-slate-500">{a.invited} invited · {a.joined} joined · {a.started} started</span>
                <span className="ml-auto flex flex-wrap gap-1">{a.badges.map((b) => <BadgeChip key={b.track} badge={b} />)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
