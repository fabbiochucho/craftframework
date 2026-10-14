import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { HealthSecurityPage } from '../pages/workspace/HealthSecurityPage'

export const Route = createFileRoute('/app/workspaces/$workspaceId/health-security')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <HealthSecurityPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
