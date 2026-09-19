import { useEffect, useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { ShieldCheck, Loader2, MailWarning, Building2 } from 'lucide-react'
import { useApp } from '../lib/context'
import * as api from '../lib/api'
import { BRAND, getViewLevel } from '../lib/data'
import { Card, CardContent, Input, Button, Badge } from '../components/ui'
import { Logo } from '../components/Logo'

// The client-facing accept-invitation handshake. A firm invites a client; the
// client lands here via the tokenised link, provisions their OWN isolated tenant,
// and — by accepting — grants the inviting reviewer scoped, revocable read access
// to their results. Data sovereignty stays with the client: they can revoke the
// firm at any time from Settings.
export function AcceptInvitePage() {
  const { token } = useParams({ from: '/accept/$token' })
  const navigate = useNavigate()
  const { register, grantAccess } = useApp()

  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState<api.Invitation | null>(null)
  const [orgName, setOrgName] = useState('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    let active = true
    api.fetchInvitationByToken(token).then(inv => {
      if (!active) return
      setInvite(inv)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [token])

  function accept() {
    if (!invite || !orgName.trim()) return
    setAccepting(true)
    // Provision the invitee's own isolated tenant.
    const tenantId = api.tenantOrgId(invite.email)
    // Grant the inviting reviewer scoped, active read access to this new tenant,
    // added to the portfolio named on the invitation.
    if (invite.inviter) {
      api.saveAccessGrant({
        orgId: tenantId,
        grantee: invite.inviter,
        grantedBy: invite.email,
        status: 'active',
        portfolioId: invite.portfolioId,
      })
      if (invite.portfolioId) {
        // Best-effort: attach this org to the reviewer's portfolio membership.
        api.fetchPortfolios(invite.inviter).then(pfs => {
          const pf = pfs.find(p => p.id === invite.portfolioId)
          if (pf) {
            api.savePortfolio({
              id: pf.id,
              name: pf.name,
              orgIds: [...new Set([...pf.orgIds, tenantId])],
              reviewer: invite.inviter,
            })
          }
        })
      }
    }
    api.updateInvitationStatus(token, 'accepted')
    // Sign the invitee into their brand-new workspace.
    register(invite.email, orgName.trim())
    if (invite.inviter) grantAccess(tenantId, invite.inviter, invite.portfolioId)
    navigate({ to: '/onboarding' })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-950 to-slate-900 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Logo className="h-10 w-10" />
          <div>
            <p className="font-display text-lg font-bold text-white">{BRAND.product}</p>
            <p className="text-xs text-amber-400">{BRAND.institute}</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            {loading ? (
              <div className="flex flex-col items-center py-8 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="mt-3 text-sm">Validating your invitation…</p>
              </div>
            ) : !invite || invite.status !== 'pending' ? (
              <div className="flex flex-col items-center py-8 text-center">
                <MailWarning className="h-10 w-10 text-rose-400" />
                <h1 className="mt-3 font-display text-xl font-bold text-slate-800">Invitation unavailable</h1>
                <p className="mt-2 max-w-xs text-sm text-slate-500">
                  {invite?.status === 'accepted'
                    ? 'This invitation has already been accepted.'
                    : invite?.status === 'expired'
                      ? 'This invitation has expired. Ask your reviewer to send a new one.'
                      : 'We could not find a valid invitation for this link.'}
                </p>
                <Button className="mt-4" variant="outline" onClick={() => navigate({ to: '/auth' })}>
                  Go to sign in
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <h1 className="font-display text-xl font-bold text-emerald-900">You're invited</h1>
                </div>
                <p className="text-sm text-slate-600">
                  {invite.inviterName || invite.inviter || 'A reviewer'} invited you to join {BRAND.product} as an
                  independent, sovereign institution. Name your workspace to accept.
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="flex items-center justify-between"><span>Invited email</span><strong>{invite.email}</strong></p>
                  <p className="mt-1 flex items-center justify-between">
                    <span>Access level</span>
                    <Badge className="bg-emerald-100 text-emerald-700">{getViewLevel(invite.role as never).label}</Badge>
                  </p>
                  {invite.scopeLabel && (
                    <p className="mt-1 flex items-center justify-between"><span>Scope</span><strong>{invite.scopeLabel}</strong></p>
                  )}
                </div>
                <Input
                  label="Your institution name"
                  placeholder="National Public Health Agency"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                />
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Accepting creates your own isolated workspace and grants{' '}
                  <strong>{invite.inviter}</strong> read-only access to your results. You keep full ownership and can
                  revoke this access at any time from Settings.
                </p>
                <Button className="w-full" disabled={!orgName.trim() || accepting} onClick={accept}>
                  <Building2 className="h-4 w-4" /> Accept &amp; create my workspace
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
