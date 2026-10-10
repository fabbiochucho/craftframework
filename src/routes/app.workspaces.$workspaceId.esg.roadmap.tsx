import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { EsgRoadmapPage } from '../pages/workspace/EsgCapPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/esg/roadmap')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <EsgRoadmapPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
