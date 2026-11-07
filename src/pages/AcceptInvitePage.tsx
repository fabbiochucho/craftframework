import { useEffect, useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { logout as identityLogout } from '@netlify/identity'
import { ShieldCheck, Loader2, MailWarning, Building2, LogIn, UserPlus } from 'lucide-react'
import { useAuthCtx } from '../lib/context'
import * as api from '../lib/api'
import { BRAND, getViewLevel } from '../lib/data'
import { Card, CardContent, Input, Button, Badge } from '../components/ui'
import { Logo } from '../components/Logo'
import { forgetInvite, rememberInvite } from '../lib/pendingInvite'

// The accept-invitation handshake. The invitee follows the tokenised link from the email, signs in
// (or creates an account) AS THE INVITED EMAIL, then accepts. Everything the invitation does is
// applied on the server (POST /api/invitations/accept):
//   member        joins the inviting organisation with the role on the invitation
//   organization  gets its own isolated workspace, then the portfolio / engagement / network link
// Data sovereignty stays with the organisation: access it gives can be revoked from Settings.
export function AcceptInvitePage() {
  const { token } = useParams({ from: '/accept/$token' })
  const navigate = useNavigate()
  const { currentUser, authReady, logout } = useAuthCtx()
  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState<api.Invitation | null>(null)
  const [orgName, setOrgName] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ next: string; warning?: string } | null>(null)

  useEffect(() => {
    let active = true
    api.fetchInvitationByToken(token).then(inv => {
      if (!active) return
      setInvite(inv)
      setOrgName(inv?.orgName ?? '')
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [token])

  const signedIn = authReady && !!currentUser && !currentUser.isDemo
  const sameEmail = signedIn && !!invite && currentUser!.email.trim().toLowerCase() === invite.email.trim().toLowerCase()
  const isOrg = invite?.kind === 'organization'

  function goToAuth(mode: 'register' | 'login') {
    if (!invite) return
    rememberInvite(token)
    const params = new URLSearchParams({ next: `/accept/${token}`, email: invite.email, ...(mode === 'register' ? { mode } : {}) })
    window.location.assign(`/auth?${params.toString()}`)
  }

  async function accept() {
    if (!invite) return
    setAccepting(true)
    setError(null)
    const out = await api.acceptInvitation(token, isOrg ? orgName.trim() : undefined)
    setAccepting(false)
    if (!out.ok) {
      setError(out.error)
      return
    }
    forgetInvite()
    if (out.warning) setDone({ next: out.next, warning: out.warning })
    // A full load re-resolves the session at its (possibly new) organisation and role.
    else window.location.assign(out.next)
  }

  function decline() {
    api.updateInvitationStatus(token, 'revoked')
    forgetInvite()
    setInvite(invite ? { ...invite, status: 'revoked' } : invite)
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
            {loading || !authReady ? (
              <div className="flex flex-col items-center py-8 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="mt-3 text-sm">Checking your invitation…</p>
              </div>
            ) : done ? (
              <div className="space-y-4">
                <h1 className="font-display text-xl font-bold text-emerald-900">Your workspace is ready</h1>
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{done.warning}</p>
                <Button className="w-full" onClick={() => window.location.assign(done.next)}>Continue</Button>
              </div>
            ) : !invite || invite.status !== 'pending' ? (
              <div className="flex flex-col items-center py-8 text-center">
                <MailWarning className="h-10 w-10 text-rose-400" />
                <h1 className="mt-3 font-display text-xl font-bold text-slate-800">Invitation unavailable</h1>
                <p className="mt-2 max-w-xs text-sm text-slate-500">
                  {invite?.status === 'accepted'
                    ? 'This invitation has already been accepted.'
                    : invite?.status === 'expired'
                      ? 'This invitation has expired. Ask the person who invited you to send a new one.'
                      : invite?.status === 'revoked'
                        ? 'This invitation was declined or withdrawn.'
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
                  {isOrg ? (
                    <>
                      <strong>{invite.inviterName || invite.inviter || 'Someone'}</strong> invited{' '}
                      <strong>{invite.orgName || 'your institution'}</strong> to {BRAND.product}. Accepting creates your
                      institution's own secure workspace.
                    </>
                  ) : (
                    <>
                      <strong>{invite.inviterName || invite.inviter || 'An administrator'}</strong> invited you to join{' '}
                      <strong>{invite.scopeLabel || 'their organisation'}</strong> on {BRAND.product}.
                    </>
                  )}
                </p>
                <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="flex items-center justify-between gap-3"><span>Invited email</span><strong className="break-all">{invite.email}</strong></p>
                  {isOrg ? (
                    invite.purpose && <p className="pt-1 text-slate-700">{invite.purpose}</p>
                  ) : (
                    <p className="flex items-center justify-between">
                      <span>Access level</span>
                      <Badge className="bg-emerald-100 text-emerald-700">{getViewLevel(invite.role as never).label}</Badge>
                    </p>
                  )}
                  {invite.message && <p className="pt-1 italic text-slate-700">“{invite.message}”</p>}
                </div>

                {!signedIn ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Create an account or sign in with <strong>{invite.email}</strong> to accept.</p>
                    <Button className="w-full" onClick={() => goToAuth('register')}><UserPlus className="h-4 w-4" /> Create my account</Button>
                    <Button className="w-full" variant="outline" onClick={() => goToAuth('login')}><LogIn className="h-4 w-4" /> I already have an account</Button>
                  </div>
                ) : !sameEmail ? (
                  <div className="space-y-2">
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                      You are signed in as <strong>{currentUser!.email}</strong>, but this invitation is for <strong>{invite.email}</strong>.
                    </p>
                    <Button className="w-full" variant="outline" onClick={async () => { rememberInvite(token); await identityLogout().catch(() => {}); logout(); goToAuth('login') }}>
                      Sign in as {invite.email}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {isOrg && (
                      <Input
                        label="Your institution name"
                        placeholder="National Public Health Agency"
                        value={orgName}
                        onChange={e => setOrgName(e.target.value)}
                      />
                    )}
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      {isOrg
                        ? 'You keep full ownership of your data. Any access this gives can be revoked at any time from Settings.'
                        : 'Accepting signs you in to this organisation with the access level shown.'}
                    </p>
                    {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
                    <Button className="w-full" disabled={accepting || (isOrg && orgName.trim().length < 2)} onClick={accept}>
                      <Building2 className="h-4 w-4" /> {accepting ? 'Accepting…' : isOrg ? 'Accept & set up our workspace' : 'Accept invitation'}
                    </Button>
                    <button type="button" onClick={decline} className="w-full text-center text-xs text-slate-500 underline">Decline</button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
