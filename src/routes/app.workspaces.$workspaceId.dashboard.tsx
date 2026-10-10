import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { WorkspaceDashboardPage } from '../pages/workspace/OrgPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/dashboard')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <WorkspaceDashboardPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
