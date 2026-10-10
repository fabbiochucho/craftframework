import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { SupportIssuesPage } from '../pages/workspace/EvidenceReportPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/support-issues')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <SupportIssuesPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
