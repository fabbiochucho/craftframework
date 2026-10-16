import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { ReviewPage } from '../pages/ReviewPage'

export const Route = createFileRoute('/engagements_/$id/review')({
  component: ReviewRoute,
})

function ReviewRoute() {
  const { id } = Route.useParams()
  return (
    <AppLayout>
      <ReviewPage id={id} />
    </AppLayout>
  )
}
