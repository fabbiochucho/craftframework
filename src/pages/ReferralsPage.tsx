import { useEffect, useState } from 'react'
import { Award, Medal, Send } from 'lucide-react'
import { Badge, Card, CardContent, CardHeader, CardTitle, ProgressBar } from '../components/ui'
import { BadgeChip } from '../components/AmbassadorBadges'
import { AMBASSADOR_TIERS, STAGE_LABEL, TRACK_BLURB, TRACK_LABEL, type Badge as AmbassadorBadge, type BadgeTrack, type ReferralStage } from '../lib/ambassadors'

type Referral = {
  invitationId: string; orgName: string; contact: string; link: 'network' | 'portfolio' | 'engagement' | 'other'
  sentAt: string; status: 'pending' | 'accepted' | 'expired' | 'revoked'; stage: ReferralStage
}
type Data = { referrals: Referral[]; badges: AmbassadorBadge[]; funnel: { invited: number; joined: number; started: number; assessed: number } }

const LINK_LABEL = { network: 'Network', portfolio: 'Portfolio', engagement: 'Engagement', other: 'Direct' }
const STAGE_STYLE: Record<ReferralStage, string> = {
  invited: 'bg-slate-100 text-slate-600', joined: 'bg-sky-100 text-sky-800', started: 'bg-emerald-100 text-emerald-800', assessed: 'bg-emerald-600 text-white',
}

// "Your referrals & badges": organisations you invited by email, how far each has come, and the
// ambassador badges they earn you. Badges count organisations that started their assessment.
export function ReferralsPage() {
  const [d, setD] = useState<Data | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    void fetch('/api/referrals', { cache: 'no-store' }).then(async (r) => {
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `Request failed (${r.status})`)
      return r.json()
    }).then(setD, (e) => setError(e.message))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-500"><Award className="h-4 w-4 text-amber-600" /> Recognition</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-emerald-900">Your referrals & ambassador badges</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Organisations you invited to CRAFT by email, and how far each has come. You earn ambassador badges for organisations that
          start their assessment, as a Network Ambassador, a Portfolio Ambassador and a CRAFT Ambassador overall. Badges are
          recognition only. You see each organisation's stage, never its scores or documents.
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {([['Invited', d.funnel.invited], ['Joined CRAFT', d.funnel.joined], ['Started assessment', d.funnel.started], ['Completed an assessment', d.funnel.assessed]] as const).map(([label, n]) => (
              <Card key={label}><CardContent className="p-4"><p className="text-xs text-slate-500">{label}</p><p className="font-display text-2xl font-bold text-slate-900">{n}</p></CardContent></Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Medal className="h-4 w-4 text-amber-600" /> Badges</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {(['network', 'portfolio', 'all'] as BadgeTrack[]).map((track) => {
                const b = d.badges.find((x) => x.track === track)
                const count = b?.count ?? 0
                const next = b?.next ?? { tier: AMBASSADOR_TIERS[0].label, needed: AMBASSADOR_TIERS[0].min }
                const target = count + next.needed
                return (
                  <div key={track} className="space-y-2 rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-900">{TRACK_LABEL[track]}</p>
                    <p className="text-xs text-slate-500">{TRACK_BLURB[track]}</p>
                    {b ? <BadgeChip badge={b} /> : <span className="text-xs text-slate-400">Not earned yet</span>}
                    {b?.next !== null && (
                      <>
                        <ProgressBar value={target ? (count / target) * 100 : 0} />
                        <p className="text-xs text-slate-600">{next.needed} more to reach {next.tier}</p>
                      </>
                    )}
                  </div>
                )
              })}
            </CardContent>
            <CardContent className="pt-0 text-xs text-slate-500">
              Tiers: {AMBASSADOR_TIERS.map((t) => `${t.label} ${t.min}+`).join(' · ')} organisations that started their assessment.
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Send className="h-4 w-4 text-emerald-600" /> Organisations you invited</CardTitle></CardHeader>
            <CardContent>
              {!d.referrals.length ? (
                <p className="text-sm text-slate-500">No invitations yet. Invite an organisation from your portfolio, a network level, an engagement or the Admin portal.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead><tr className="border-b text-xs text-slate-500"><th className="py-2 pr-3">Organisation</th><th className="pr-3">Through</th><th className="pr-3">Invited</th><th>Stage</th></tr></thead>
                    <tbody>
                      {d.referrals.map((r) => (
                        <tr key={r.invitationId} className="border-b border-slate-100">
                          <td className="py-2 pr-3"><p className="font-medium text-slate-900">{r.orgName || r.contact}</p><p className="text-xs text-slate-500">{r.contact}</p></td>
                          <td className="pr-3 text-slate-600">{LINK_LABEL[r.link]}</td>
                          <td className="pr-3 text-slate-600">{new Date(r.sentAt).toLocaleDateString()}</td>
                          <td>
                            <Badge className={STAGE_STYLE[r.stage]}>{r.status === 'expired' ? 'Invitation expired' : r.status === 'revoked' ? 'Declined' : STAGE_LABEL[r.stage]}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
