import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Award, Building, FolderOpen, Handshake, LifeBuoy, Search, Send, Trash } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from './ui'
import { BadgeChip } from './AmbassadorBadges'
import type { Badge as AmbassadorBadge } from '../lib/ambassadors'
import { deleteOrganization, fetchAllInvitations, fetchInvitations, fetchOrganizations, inviteOrganizationByEmail, previewInvitation, revokeInvitation, sendInvitation, setInvitationSubject, type Invitation } from '../lib/api'
import { InviteOrganizationWizard } from './InviteOrganizationWizard'
import { InviteFunderCard } from './InviteFunder'
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

export const ONBOARDING_NOTE = `Thank you for accepting to work with us in this important organisational capacity strengthening process.

We are pleased to introduce you to CRAFT, the Capacity Readiness & Fiduciary Assurance Toolkit, which has been set up so your organisation can carry out its own capacity assessment, with an independent assessor alongside you.

GETTING STARTED
Click "Accept" in this email, create your account with this email address and choose your own password (you can change it at any time). Your organisation's own secure workspace is created when you accept. Only your team, and the people you choose, can see it.

THE ASSESSMENT
You will use the CRAFT Organisational & Network Capacity Index. CRAFT adopts the NHOCAT+ tool methodology and other frameworks to assess and strengthen organisations. The Index works in a similar way to the National Harmonised Organisational Capacity Assessment Tool (NHOCAT+), its Seven Domains and Statements of Excellence, and your results are also shown against the NHOCAT domains and its four-level scale:
- 44 indicators in 11 capacity areas: governance and leadership; legal standing and accountability; strategy and programme management; financial management; people and human resources; procurement, assets and administration; monitoring, evaluation and learning; service delivery and technical capacity; resource mobilisation and sustainability; partnerships, networking and exchange; and community voice, safeguarding and advocacy.
- Each indicator has six written level statements, from 0 (not in place) to 5 (fully in place and working). Like Statements of Excellence, they describe exactly what each level looks like, so you choose the one that matches your organisation today.
- Each indicator lists the evidence that supports it (for example minutes, policies, audited accounts or reports), explains why it matters, and suggests a first step to improve.

HOW TO GET THE MOST FROM IT
- Answer honestly against the statement that matches what is in place and working now, not what is planned.
- Upload your supporting documents to your Evidence registry as you go. A score is only as strong as the evidence behind it.
- Work as a team: you can invite colleagues (for example finance, programmes and M&E staff) to help.
- Save as you go and come back at any time.

WHAT YOU RECEIVE
- An overall picture of your capacity, with clear results in plain words for each area.
- A printable assessment report laid out like an NHOCAT+ assessment sheet: organisation details, each capacity area with Capacity Scores 1 to 4, domain scores and evidence sighted, ready to sign and share.
- A Capacity Improvement Plan that turns every gap into practical, time-bound actions.
- Independent assessment: your independent assessor reviews your assessment and records independent scores. You compare the two side by side to agree where you stand. They cannot change your answers, and you control their access.
- The ability to reassess each year and track your progress over time.

Should you require any clarification or technical assistance at any point, please reply to this email or reach out to us directly.

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

/** Super Admin: invite a funder's staff in an assessor's name (the assessor is the inviter; replies go to them). */
export function InviteFunderForAssessor() {
  const [assessor, setAssessor] = useState('')
  const email = assessor.trim().toLowerCase()
  return (
    <div className="space-y-2">
      <Input label="Invite funders in this person's name (leave empty for your own)" placeholder="assessor@example.com" value={assessor} onChange={(e) => setAssessor(e.target.value)} />
      <InviteFunderCard key={email} onBehalfOf={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined} />
    </div>
  )
}

/** Invitations saved as drafts. Each is reviewed (the email exactly as it will be sent) before it can be sent. Super Admin sees all; others see their own. */
export function DraftInvitations({ all = false }: { all?: boolean }) {
  const [rows, setRows] = useState<Invitation[] | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState<string[]>([])
  const { currentUser } = useAuthCtx()
  const me = currentUser?.email ?? ''
  useEffect(() => {
    if (!all && !me) return
    void (all ? fetchAllInvitations() : fetchInvitations(me)).then((r) => setRows(r.filter((x) => x.status === 'pending' && !x.sentAt)), () => setRows([]))
  }, [all, me])
  if (!rows || !rows.length) return null
  const act = async (inv: Invitation, what: 'send' | 'delete') => {
    if (what === 'delete' && !window.confirm(`Delete the draft for ${inv.orgName || inv.email}? It will not be sent.`)) return
    setBusy(inv.id); setMsg(null)
    const out = what === 'send' ? await sendInvitation(inv.id) : await revokeInvitation(inv.id)
    setBusy(null)
    if (out.ok) { setRows((prev) => (prev ?? []).filter((x) => x.id !== inv.id)); setOpen(null) }
    setMsg(out.ok ? { ok: true, text: what === 'send' ? `Sent to ${inv.email}.` : 'Draft deleted.' } : { ok: false, text: out.error })
  }
  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Send className="h-4 w-4 text-amber-600" /> Invitations waiting to be sent ({rows.length})</CardTitle>
        <p className="text-sm text-slate-500">Drafts are not emailed until you send them. Open <strong>Review</strong> to see each email exactly as the recipient will get it; it can be sent once reviewed. Each invitation is valid for 14 days from sending.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-emerald-700' : 'text-sm text-rose-700'}>{msg.text}</p>}
        <ul className="divide-y divide-slate-100">
          {rows.map((inv) => (
            <li key={inv.id} className="py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-900">{inv.orgName || inv.email}</span>
                <span className="text-xs text-slate-500">{inv.email} · from {inv.inviter}{inv.link === 'independent_assessor' ? ' (independent assessor)' : inv.link ? ` · ${inv.link}` : ''}</span>
                <span className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setOpen(open === inv.id ? null : inv.id); setReviewed((r) => (r.includes(inv.id) ? r : [...r, inv.id])) }}>{open === inv.id ? 'Close' : 'Review'}</Button>
                  <Button size="sm" disabled={!!busy || !reviewed.includes(inv.id)} title={reviewed.includes(inv.id) ? undefined : 'Review the email first'} onClick={() => void act(inv, 'send')}>{busy === inv.id ? 'Working…' : 'Send'}</Button>
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void act(inv, 'delete')}>Delete</Button>
                </span>
              </div>
              {open === inv.id && <InvitationPreview id={inv.id} />}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/** The invitation email exactly as it will be sent, in a sandboxed frame. */
function InvitationPreview({ id }: { id: string }) {
  const [p, setP] = useState<Awaited<ReturnType<typeof previewInvitation>> | null>(null)
  const [subject, setSubject] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const reload = () => void previewInvitation(id).then(setP)
  useEffect(reload, [id])
  if (!p) return <p className="mt-2 text-xs text-slate-500">Loading preview…</p>
  if ('error' in p) return <p role="alert" className="mt-2 text-xs text-rose-700">{p.error}</p>
  return (
    <div className="mt-2 space-y-1 rounded border border-slate-200 p-2">
      <p className="text-xs text-slate-600"><strong>To:</strong> {p.to} · <strong>Replies go to:</strong> {p.replyTo ?? 'the CRAFT sender address'}</p>
      {subject === null ? (
        <p className="text-xs text-slate-600"><strong>Subject:</strong> {p.subject} <button type="button" className="ml-1 text-emerald-700 underline" onClick={() => setSubject(p.subject)}>Edit</button></p>
      ) : (
        <form className="flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); const out = await setInvitationSubject(id, subject); if (out.ok) { setSubject(null); setErr(null); reload() } else setErr(out.error) }}>
          <Input label="Subject (leave empty for the standard one)" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Button size="sm" type="submit">Save subject</Button>
          <Button size="sm" type="button" variant="outline" onClick={() => setSubject(null)}>Cancel</Button>
        </form>
      )}
      {err && <p role="alert" className="text-xs text-rose-700">{err}</p>}
      <iframe title="Invitation email preview" sandbox="" srcDoc={p.html} className="h-[28rem] w-full rounded border border-slate-100 bg-white" />
    </div>
  )
}

const DELIVERY: Record<string, { label: string; cls: string }> = {
  accepted: { label: 'Accepted', cls: 'bg-emerald-100 text-emerald-800' },
  revoked: { label: 'Withdrawn or declined', cls: 'bg-slate-100 text-slate-600' },
  expired: { label: 'Expired', cls: 'bg-slate-100 text-slate-600' },
  delivered: { label: 'Delivered', cls: 'bg-sky-100 text-sky-800' },
  sent: { label: 'Sent', cls: 'bg-slate-100 text-slate-700' },
  delayed: { label: 'Delivery delayed', cls: 'bg-amber-100 text-amber-800' },
  bounced: { label: 'Bounced: check the address', cls: 'bg-rose-100 text-rose-800' },
  complained: { label: 'Marked as spam', cls: 'bg-rose-100 text-rose-800' },
}

/** Sent invitations with delivery (from Resend) and acceptance; a pending one can be withdrawn. Opens are not tracked. */
export function SentInvitations({ all = false }: { all?: boolean }) {
  const [rows, setRows] = useState<Invitation[] | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const { currentUser } = useAuthCtx()
  const me = currentUser?.email ?? ''
  const load = () => void (all ? fetchAllInvitations() : fetchInvitations(me)).then((r) => setRows(r.filter((x) => x.sentAt && x.kind !== 'member')), () => setRows([]))
  useEffect(() => { if (all || me) load() }, [all, me])
  if (!rows || !rows.length) return null
  const withdraw = async (inv: Invitation) => {
    if (!window.confirm(`Withdraw the invitation to ${inv.orgName || inv.email}? Its link will stop working.`)) return
    const out = await revokeInvitation(inv.id)
    setMsg(out.ok ? { ok: true, text: 'Invitation withdrawn.' } : { ok: false, text: out.error })
    if (out.ok) load()
  }
  const when = (d?: string) => (d ? new Date(d).toLocaleString() : '')
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Send className="h-4 w-4 text-emerald-600" /> Sent invitations ({rows.length})</CardTitle>
        <p className="text-sm text-slate-500">Delivery is reported by our email provider. Opens are not tracked. Every event is also in the audit log.</p>
      </CardHeader>
      <CardContent>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-emerald-700' : 'text-sm text-rose-700'}>{msg.text}</p>}
        <ul className="divide-y divide-slate-100">
          {rows.map((inv) => {
            const d = DELIVERY[inv.status === 'pending' ? inv.deliveryStatus ?? 'sent' : inv.status] ?? DELIVERY.sent
            return (
              <li key={inv.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-medium text-slate-900">{inv.orgName || inv.email}</span>
                <span className="text-xs text-slate-500">{inv.email} · from {inv.inviter} · sent {when(inv.sentAt)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.cls}`}>{d.label}</span>
                <span className="text-xs text-slate-400">{when(inv.status === 'pending' ? inv.deliveryAt : inv.respondedAt)}</span>
                {inv.status === 'pending' && <Button size="sm" variant="outline" className="ml-auto" onClick={() => void withdraw(inv)}>Withdraw</Button>}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
