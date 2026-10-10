import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { AssessmentsListPage } from '../pages/workspace/GovernancePages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/governance/assessments/')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <AssessmentsListPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
