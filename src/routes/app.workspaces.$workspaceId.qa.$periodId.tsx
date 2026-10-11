import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { QaPeriodPage } from '../pages/workspace/PlannerQaPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/qa/$periodId')({
  component: () => {
    const { workspaceId, periodId } = Route.useParams()
    return (
      <AppLayout>
        <QaPeriodPage workspaceId={workspaceId} periodId={periodId} />
      </AppLayout>
    )
  },
})
