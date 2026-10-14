import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { RegulatorySourcesPage } from '../pages/workspace/RegulatorySourcesPage'

export const Route = createFileRoute('/app/workspaces/$workspaceId/regulatory-sources')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <RegulatorySourcesPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
