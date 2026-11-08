// Invitations for every signed-in user: invite organisations (naming yourself their independent assessor)
// and funders, review drafts before sending, and follow delivery. Invitations go out in your own name.
import { useState } from 'react'
import { Handshake, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui'
import { InviteOrganizationWizard } from '../components/InviteOrganizationWizard'
import { InviteFunderCard } from '../components/InviteFunder'
import { DraftInvitations, ONBOARDING_NOTE, SentInvitations } from '../components/SupportAdmin'
import { inviteOrganizationByEmail } from '../lib/api'
import { useAuthCtx } from '../lib/context'

export function InvitationsPage() {
  const { currentUser } = useAuthCtx()
  const [refresh, setRefresh] = useState(0)
  const me = currentUser?.email || 'you'
  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500"><Send className="h-4 w-4 text-emerald-600" /> Invitations</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Invite organisations and funders</h1>
        <p className="mt-1 text-sm text-slate-500">Invitations go out in your name and replies come to you. Everything is saved as a draft first: review each email, then send it.</p>
      </div>
      <DraftInvitations key={`d${refresh}`} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Handshake className="h-4 w-4 text-emerald-600" /> Invite an organisation to assess</CardTitle>
          <p className="text-sm text-slate-500">When it accepts, the organisation gets its own workspace and names you its independent assessor: you record independent scores alongside its own, but never change its answers, and it can revoke your access.</p>
        </CardHeader>
        <CardContent>
          {currentUser && (
            <InviteOrganizationWizard
              purpose={`Names ${me} as your organisation's independent assessor: they can see your assessment and record independent scores alongside yours. They cannot change your answers, and you can revoke their access at any time.`}
              inviterName={me}
              inviterEmail={currentUser.email}
              allowDraft
              defaultMessage={ONBOARDING_NOTE}
              onSend={async (v) => {
                const out = await inviteOrganizationByEmail({
                  email: v.email, orgName: v.orgName, inviteeName: v.inviteeName || undefined, message: v.message || undefined,
                  orgArchetype: v.orgArchetype || undefined, orgSector: v.orgSector || undefined, orgCountry: v.orgCountry || undefined,
                  send: v.send, grantRole: 'independent_assessor',
                })
                if (out.ok) setRefresh((n) => n + 1)
                return out.ok ? { ok: true } : { ok: false, error: out.error }
              }}
            />
          )}
        </CardContent>
      </Card>
      <InviteFunderCard onDone={() => setRefresh((n) => n + 1)} />
      <SentInvitations key={`s${refresh}`} />
    </div>
  )
}
