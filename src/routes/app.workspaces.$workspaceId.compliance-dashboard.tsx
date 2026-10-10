import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { ComplianceDashboardPage } from '../pages/workspace/EvidenceReportPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/compliance-dashboard')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <ComplianceDashboardPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
