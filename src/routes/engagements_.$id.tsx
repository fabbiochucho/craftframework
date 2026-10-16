import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { EngagementDetailPage } from '../pages/EngagementsPage'

export const Route = createFileRoute('/engagements_/$id')({
  component: EngagementRoute,
})

function EngagementRoute() {
  const { id } = Route.useParams()
  return (
    <AppLayout>
      <EngagementDetailPage id={id} />
    </AppLayout>
  )
}
