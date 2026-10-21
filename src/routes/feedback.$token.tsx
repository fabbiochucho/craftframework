import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { FeedbackSurveyPage } from '../pages/FeedbackSurveyPage'

// /feedback/<signed token>: the in-app survey behind the lifecycle emails. No sign-in; the token is the credential.
export const Route = createFileRoute('/feedback/$token')({
  head: () => ({ meta: [{ title: 'Your feedback | CRAFT' }, { name: 'robots', content: 'noindex, nofollow' }, { name: 'referrer', content: 'no-referrer' }] }),
  component: FeedbackRoute,
})

function FeedbackRoute() {
  const { token } = Route.useParams()
  return <PublicLayout><FeedbackSurveyPage token={token} /></PublicLayout>
}
