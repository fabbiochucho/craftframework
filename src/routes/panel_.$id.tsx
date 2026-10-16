import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { ReviewPanelCasePage } from '../pages/ReviewPanelPage'

export const Route = createFileRoute('/panel_/$id')({
  component: PanelCaseRoute,
})

function PanelCaseRoute() {
  const { id } = Route.useParams()
  return (
    <AppLayout>
      <ReviewPanelCasePage id={id} />
    </AppLayout>
  )
}
