import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { MemberBadgePage } from '../pages/MemberBadgePage'

// /badge: signed-in people see their own organisation's badge; the signed link in the milestone email works without sign-in.
export const Route = createFileRoute('/badge')({
  validateSearch: (search: Record<string, unknown>): { t?: string } => (typeof search.t === 'string' ? { t: search.t } : {}),
  head: () => ({ meta: [{ title: 'Your CRAFT member badge | CRAFT' }, { name: 'robots', content: 'noindex, nofollow' }, { name: 'referrer', content: 'no-referrer' }] }),
  component: BadgeRoute,
})

function BadgeRoute() {
  const { t } = Route.useSearch()
  return <PublicLayout><MemberBadgePage token={t} /></PublicLayout>
}
