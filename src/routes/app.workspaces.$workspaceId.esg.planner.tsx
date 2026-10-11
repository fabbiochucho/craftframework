import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { SecPlannerPage } from '../pages/workspace/PlannerQaPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/esg/planner')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <SecPlannerPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
