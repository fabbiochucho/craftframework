import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { SupportBotPage } from '../pages/workspace/EvidenceReportPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/support-bot')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <SupportBotPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
