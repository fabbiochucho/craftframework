import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Award, Building, FolderOpen, Handshake, LifeBuoy, Search, Send, Trash } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from './ui'
import { BadgeChip } from './AmbassadorBadges'
import type { Badge as AmbassadorBadge } from '../lib/ambassadors'
import { deleteOrganization, fetchAllInvitations, fetchInvitations, fetchOrganizations, inviteOrganizationByEmail, sendInvitation, type Invitation } from '../lib/api'
import { InviteOrganizationWizard } from './InviteOrganizationWizard'
import { useAuthCtx } from '../lib/context'

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

type OrgRow = { id: string; name: string; email: string; country: string; createdAt: string; status?: string }

/**
 * Super Admin: every institution on CRAFT (self-registered, invited or created by anyone), with
 * search and permanent delete. The Admin portal's own list shows only institutions you created.
 */
export function AllOrganisations() {
  const [rows, setRows] = useState<OrgRow[] | null>(null)
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { void fetchOrganizations().then((r) => setRows(r as unknown as OrgRow[]), () => setRows([])) }, [])
  const shown = (rows ?? []).filter((o) => !q.trim() || `${o.name} ${o.email} ${o.id}`.toLowerCase().includes(q.trim().toLowerCase()))
  const del = async (o: OrgRow) => {
    setBusy(true); setMsg(null)
    const out = await deleteOrganization(o.id)
    setBusy(false)
    if (!out.ok) { setMsg({ ok: false, text: `Could not delete ${o.name}: ${out.error}` }); return }
    setRows((prev) => (prev ?? []).filter((x) => x.id !== o.id))
    setConfirming(null); setTyped('')
    setMsg({ ok: true, text: `${o.name} and all its data were permanently deleted.` })
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building className="h-4 w-4 text-emerald-600" /> All organisations on CRAFT{rows ? ` (${rows.length})` : ''}</CardTitle>
        <p className="text-sm text-slate-500">Every institution, including self-registered and invited ones. Deleting one permanently removes it with its assessments, plans, team assignments, access grants, portfolio and network memberships and engagements. It cannot be undone.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input label="Search by name, email or id" value={q} onChange={(e) => setQ(e.target.value)} />
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-emerald-700' : 'text-sm text-rose-700'}>{msg.text}</p>}
        {!rows ? <p className="text-sm text-slate-500">Loading…</p> : (
          <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
            {shown.slice(0, 200).map((o) => (
              <li key={o.id} className="space-y-2 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{o.name || '(no name)'}</span>
                  {o.status === 'archived' && <Badge className="bg-slate-200 text-slate-600">Archived</Badge>}
                  <span className="text-xs text-slate-500">{[o.email, o.country, o.id].filter(Boolean).join(' · ')}</span>
                  {confirming !== o.id && (
                    <Button size="sm" variant="outline" className="ml-auto border-rose-300 text-rose-700 hover:bg-rose-50"
                      onClick={() => { setConfirming(o.id); setTyped(''); setMsg(null) }}><Trash className="h-3.5 w-3.5" /> Delete</Button>
                  )}
                </div>
                {confirming === o.id && (
                  <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50/50 p-3">
                    <Input label={`Type “${o.name}” to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-rose-600 hover:bg-rose-700" disabled={busy || typed.trim().toLowerCase() !== (o.name || '').trim().toLowerCase()}
                        onClick={() => void del(o)}>{busy ? 'Deleting…' : 'Delete permanently'}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
            {!shown.length && <li className="py-2 text-sm text-slate-500">No organisation matches.</li>}
          </ul>
        )}
        {shown.length > 200 && <p className="text-xs text-slate-500">Showing the first 200. Search to narrow down.</p>}
      </CardContent>
    </Card>
  )
}

const ONBOARDING_NOTE = `Thank you for accepting to work with us in this important organisational capacity strengthening process.

We are pleased to introduce you to CRAFT, which has been configured to enable you to administer your organisation's capacity assessment independently.

Your organisation's profile will be created on the platform when you accept: click Accept, create your account with this email address and choose your own password. You can change it at any time after signing in.

The CRAFT tool guides you through the assessment. We encourage you to review each statement carefully and give responses that accurately reflect your organisation's current capacity, systems, structures and practices.

Should you require any clarification or technical assistance, please do not hesitate to reach out.

Thank you once again for your cooperation and commitment.`

/** Super Admin: invite organisations in an independent assessor's name (drafts or send now). */
export function InviteForAssessor() {
  const [assessor, setAssessor] = useState('')
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assessor.trim())
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Handshake className="h-4 w-4 text-emerald-600" /> Invite organisations for an independent assessor</CardTitle>
        <p className="text-sm text-slate-500">
          Invite organisations in the assessor's name: the email says the assessor invited them and replies go to the assessor. When an
          organisation accepts, it gets its own workspace and names the assessor as its independent assessor, who can then score it
          independently (compared on Trust Delta) but never change its answers. Save as drafts and send when you are ready.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input label="Independent assessor's email" placeholder="assessor@example.com" value={assessor} onChange={(e) => setAssessor(e.target.value)} />
        {valid ? (
          <InviteOrganizationWizard
            key={assessor.trim().toLowerCase()}
            purpose={`Names ${assessor.trim()} as your organisation's independent assessor: they can see your assessment and record independent scores alongside yours. They cannot change your answers, and you can revoke this at any time.`}
            inviterName={assessor.trim()}
            inviterEmail={assessor.trim()}
            allowDraft
            defaultMessage={ONBOARDING_NOTE}
            onSend={async (v) => {
              const out = await inviteOrganizationByEmail({
                email: v.email, orgName: v.orgName, inviteeName: v.inviteeName || undefined, message: v.message || undefined,
                orgArchetype: v.orgArchetype || undefined, orgSector: v.orgSector || undefined, orgCountry: v.orgCountry || undefined,
                send: v.send, onBehalfOf: assessor.trim().toLowerCase(), grantRole: 'independent_assessor',
              })
              return out.ok ? { ok: true } : { ok: false, error: out.error }
            }}
          />
        ) : <p className="text-xs text-slate-500">Enter the assessor's email to start.</p>}
      </CardContent>
    </Card>
  )
}

/** Invitations saved as drafts, with Send and Send all. Super Admin sees all; others see their own. */
export function DraftInvitations({ all = false }: { all?: boolean }) {
  const [rows, setRows] = useState<Invitation[] | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const { currentUser } = useAuthCtx()
  const me = currentUser?.email ?? ''
  useEffect(() => {
    if (!all && !me) return
    void (all ? fetchAllInvitations() : fetchInvitations(me)).then((r) => setRows(r.filter((x) => x.status === 'pending' && !x.sentAt)), () => setRows([]))
  }, [all, me])
  if (!rows || !rows.length) return null
  const sendOne = async (inv: Invitation) => {
    const out = await sendInvitation(inv.id)
    if (out.ok) setRows((prev) => (prev ?? []).filter((x) => x.id !== inv.id))
    return out
  }
  const sendAll = async () => {
    setBusy('all'); setMsg(null)
    let ok = 0
    const failed: string[] = []
    for (const inv of rows) {
      const out = await sendOne(inv)
      if (out.ok) ok += 1
      else failed.push(`${inv.orgName || inv.email}: ${out.error}`)
    }
    setBusy(null)
    setMsg(failed.length ? { ok: false, text: `Sent ${ok}. Not sent: ${failed.join('; ')}` } : { ok: true, text: `Sent ${ok} invitation${ok === 1 ? '' : 's'}.` })
  }
  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Send className="h-4 w-4 text-amber-600" /> Invitations waiting to be sent ({rows.length})</CardTitle>
        <p className="text-sm text-slate-500">Drafts are not emailed until you send them. Each invitation is valid for 14 days from sending.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button size="sm" disabled={!!busy} onClick={() => void sendAll()}><Send className="h-4 w-4" /> {busy === 'all' ? 'Sending…' : `Send all ${rows.length}`}</Button>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-emerald-700' : 'text-sm text-rose-700'}>{msg.text}</p>}
        <ul className="divide-y divide-slate-100">
          {rows.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="font-medium text-slate-900">{inv.orgName || inv.email}</span>
              <span className="text-xs text-slate-500">{inv.email} · from {inv.inviter}{inv.link === 'independent_assessor' ? ' (independent assessor)' : inv.link ? ` · ${inv.link}` : ''}</span>
              <Button size="sm" variant="outline" className="ml-auto" disabled={!!busy}
                onClick={async () => { setBusy(inv.id); setMsg(null); const out = await sendOne(inv); setBusy(null); setMsg(out.ok ? { ok: true, text: `Sent to ${inv.email}.` } : { ok: false, text: out.error }) }}>
                {busy === inv.id ? 'Sending…' : 'Send'}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
