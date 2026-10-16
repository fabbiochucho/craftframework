import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { DirectoryProfilePage } from '../pages/DirectoryPage'

export const Route = createFileRoute('/directory_/$kind/$id')({
  component: DirectoryProfileRoute,
})

function DirectoryProfileRoute() {
  const { kind, id } = Route.useParams()
  return (
    <AppLayout>
      <DirectoryProfilePage kind={kind} id={id} />
    </AppLayout>
  )
}
