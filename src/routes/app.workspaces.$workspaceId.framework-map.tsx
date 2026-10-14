import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { FrameworkMapPage } from '../pages/workspace/FrameworkMapPage'

export const Route = createFileRoute('/app/workspaces/$workspaceId/framework-map')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <FrameworkMapPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
