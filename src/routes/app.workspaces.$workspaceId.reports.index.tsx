import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { ReportsPage } from '../pages/workspace/EvidenceReportPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/reports/')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <ReportsPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
