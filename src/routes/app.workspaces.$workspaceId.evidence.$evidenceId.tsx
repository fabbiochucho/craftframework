import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { EvidenceDetailPage } from '../pages/workspace/EvidenceReportPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/evidence/$evidenceId')({
  component: () => {
    const { workspaceId, evidenceId } = Route.useParams()
    return (
      <AppLayout>
        <EvidenceDetailPage workspaceId={workspaceId} evidenceId={evidenceId} />
      </AppLayout>
    )
  },
})
