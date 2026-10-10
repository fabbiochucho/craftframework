import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { EsgFrameworksPage } from '../pages/workspace/EsgCapPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/esg/frameworks')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <EsgFrameworksPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
