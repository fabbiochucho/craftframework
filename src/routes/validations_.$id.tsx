import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { ValidationDetailPage } from '../pages/ValidationsPage'

export const Route = createFileRoute('/validations_/$id')({
  component: ValidationRoute,
})

function ValidationRoute() {
  const { id } = Route.useParams()
  return (
    <AppLayout>
      <ValidationDetailPage id={id} />
    </AppLayout>
  )
}
