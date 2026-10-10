import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { CapHubPage } from '../pages/workspace/EsgCapPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/actions/')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <CapHubPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
