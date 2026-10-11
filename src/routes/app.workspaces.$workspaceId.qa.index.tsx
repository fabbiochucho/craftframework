import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { QaListPage } from '../pages/workspace/PlannerQaPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/qa/')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <QaListPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
