import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Award, Medal } from 'lucide-react'
import type { Badge as AmbassadorBadge, TierId } from '../lib/ambassadors'

// Ambassador badges: recognition for people who bring organisations to CRAFT (src/lib/ambassadors.ts).

const TIER_STYLE: Record<TierId, string> = {
  connector: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  bronze: 'bg-orange-50 text-orange-800 ring-orange-200',
  silver: 'bg-slate-100 text-slate-700 ring-slate-300',
  gold: 'bg-amber-50 text-amber-800 ring-amber-300',
}

export function BadgeChip({ badge, compact = false }: { badge: AmbassadorBadge; compact?: boolean }) {
  return (
    <span title={`${badge.label}: ${badge.count} organisation${badge.count === 1 ? '' : 's'} brought to CRAFT that started their assessment`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${TIER_STYLE[badge.tier]}`}>
      <Medal className="h-3 w-3" aria-hidden /> {compact ? badge.tierLabel : badge.label}
    </span>
  )
}

/** Badges for a list of people, fetched once (badges only, no referral details). */
export function usePeopleBadges(emails: string[]): Record<string, AmbassadorBadge[]> {
  const key = [...new Set(emails.map((e) => e.toLowerCase()))].sort().join(',')
  const [badges, setBadges] = useState<Record<string, AmbassadorBadge[]>>({})
  useEffect(() => {
    if (!key) return
    const params = new URLSearchParams()
    for (const e of key.split(',')) params.append('email', e)
    void fetch(`/api/referrals/badges?${params}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {})).then(setBadges, () => {})
  }, [key])
  return badges
}

/** Chips for one person, from a badges map (renders nothing without badges). */
export function PersonBadges({ email, badges }: { email: string; badges: Record<string, AmbassadorBadge[]> }) {
  const mine = badges[email.toLowerCase()] ?? []
  if (!mine.length) return null
  return <span className="ml-1 inline-flex flex-wrap gap-1">{mine.map((b) => <BadgeChip key={b.track} badge={b} />)}</span>
}

/** A compact "your ambassador badges" strip linking to /referrals. */
export function MyAmbassadorStrip() {
  const [d, setD] = useState<{ badges: AmbassadorBadge[]; funnel: { invited: number; started: number } } | null>(null)
  useEffect(() => { void fetch('/api/referrals', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setD, () => {}) }, [])
  if (!d || !d.funnel.invited) return null
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-2 text-sm">
      <Award className="h-4 w-4 text-amber-600" aria-hidden />
      <span className="text-slate-700">You brought {d.funnel.invited} organisation{d.funnel.invited === 1 ? '' : 's'} to CRAFT · {d.funnel.started} started their assessment</span>
      {d.badges.map((b) => <BadgeChip key={b.track} badge={b} />)}
      <Link to="/referrals" className="ml-auto font-semibold text-emerald-700 underline">Your referrals & badges</Link>
    </div>
  )
}
