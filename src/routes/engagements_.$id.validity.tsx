import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { ValidityPage } from '../pages/ValidityPage'

export const Route = createFileRoute('/engagements_/$id/validity')({
  component: ValidityRoute,
})

function ValidityRoute() {
  const { id } = Route.useParams()
  return (
    <AppLayout>
      <ValidityPage id={id} />
    </AppLayout>
  )
}
