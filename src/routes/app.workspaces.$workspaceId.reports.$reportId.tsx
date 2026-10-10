import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { ReportViewPage } from '../pages/workspace/EvidenceReportPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/reports/$reportId')({
  component: () => {
    const { workspaceId, reportId } = Route.useParams()
    return (
      <AppLayout>
        <ReportViewPage workspaceId={workspaceId} reportId={reportId} />
      </AppLayout>
    )
  },
})
