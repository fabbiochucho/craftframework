import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { EmailPreferencesPage } from '../pages/EmailPreferencesPage'

// /email-preferences?t=<signed token>: no sign-in needed. Without a token it shows the signed-in person's own choices.
export const Route = createFileRoute('/email-preferences')({
  validateSearch: (search: Record<string, unknown>): { t?: string } => (typeof search.t === 'string' ? { t: search.t } : {}),
  head: () => ({ meta: [{ title: 'Email preferences | CRAFT' }, { name: 'robots', content: 'noindex, nofollow' }, { name: 'referrer', content: 'no-referrer' }] }),
  component: PreferencesRoute,
})

function PreferencesRoute() {
  const { t } = Route.useSearch()
  return <PublicLayout><EmailPreferencesPage token={t} /></PublicLayout>
}
