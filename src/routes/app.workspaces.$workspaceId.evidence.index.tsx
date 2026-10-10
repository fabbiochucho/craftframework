import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { EvidencePage } from '../pages/workspace/EvidenceReportPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/evidence/')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <EvidencePage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
