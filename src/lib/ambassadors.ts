// Referrals and ambassador badges. A referral is an organisation someone invited by email. Badges count
// only organisations that actually STARTED their assessment, so recognition follows real impact and
// never rewards sending invitations. Recognition only: no money or discounts, so a validator is never
// paid to bring in an organisation it might later validate.
export type ReferralLink = 'network' | 'portfolio' | 'engagement' | 'other'
export type ReferralStage = 'invited' | 'joined' | 'started' | 'assessed'
export type BadgeTrack = 'network' | 'portfolio' | 'all'
export type TierId = 'connector' | 'bronze' | 'silver' | 'gold'

export const AMBASSADOR_TIERS: Array<{ id: TierId; label: string; min: number }> = [
  { id: 'connector', label: 'Connector', min: 1 },
  { id: 'bronze', label: 'Bronze', min: 3 },
  { id: 'silver', label: 'Silver', min: 10 },
  { id: 'gold', label: 'Gold', min: 25 },
]
export const TRACK_LABEL: Record<BadgeTrack, string> = {
  network: 'Network Ambassador',
  portfolio: 'Portfolio Ambassador',
  all: 'CRAFT Ambassador',
}
export const TRACK_BLURB: Record<BadgeTrack, string> = {
  network: 'Organisations brought into a CRAFT network that started their assessment',
  portfolio: 'Organisations brought into a portfolio that started their assessment',
  all: 'All organisations brought to CRAFT that started their assessment',
}
export const STAGE_LABEL: Record<ReferralStage, string> = {
  invited: 'Invited',
  joined: 'Joined CRAFT',
  started: 'Started assessment',
  assessed: 'Completed an assessment',
}

export type Badge = { track: BadgeTrack; tier: TierId; tierLabel: string; label: string; count: number; next: { tier: string; needed: number } | null }

/** Counts towards a badge: the organisation started (or completed) its assessment. */
export const counts = (stage: ReferralStage) => stage === 'started' || stage === 'assessed'

export function tierFor(count: number) {
  return [...AMBASSADOR_TIERS].reverse().find((t) => count >= t.min) ?? null
}

/** Badges earned from a person's referrals: one per track that has at least one counting referral. */
export function badgesFor(referrals: Array<{ link: ReferralLink; stage: ReferralStage }>): Badge[] {
  const out: Badge[] = []
  for (const track of ['network', 'portfolio', 'all'] as BadgeTrack[]) {
    const count = referrals.filter((r) => counts(r.stage) && (track === 'all' || r.link === track)).length
    const tier = tierFor(count)
    if (!tier) continue
    const nextTier = AMBASSADOR_TIERS.find((t) => t.min > count)
    out.push({
      track, tier: tier.id, tierLabel: tier.label, label: `${TRACK_LABEL[track]} · ${tier.label}`, count,
      next: nextTier ? { tier: nextTier.label, needed: nextTier.min - count } : null,
    })
  }
  return out
}

/** Invited → joined → started → assessed, for a funnel. */
export function funnel(stages: ReferralStage[]) {
  const at = (s: ReferralStage[]) => stages.filter((x) => s.includes(x)).length
  return {
    invited: stages.length,
    joined: at(['joined', 'started', 'assessed']),
    started: at(['started', 'assessed']),
    assessed: at(['assessed']),
  }
}
