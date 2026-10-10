import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { CapDetailPage } from '../pages/workspace/EsgCapPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/actions/$capId')({
  component: () => {
    const { workspaceId, capId } = Route.useParams()
    return (
      <AppLayout>
        <CapDetailPage workspaceId={workspaceId} capId={capId} />
      </AppLayout>
    )
  },
})
