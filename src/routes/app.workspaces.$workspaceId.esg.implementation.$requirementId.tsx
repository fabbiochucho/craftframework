import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { EsgPlanPage } from '../pages/workspace/EsgCapPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/esg/implementation/$requirementId')({
  component: () => {
    const { workspaceId, requirementId } = Route.useParams()
    return (
      <AppLayout>
        <EsgPlanPage workspaceId={workspaceId} requirementId={requirementId} />
      </AppLayout>
    )
  },
})
