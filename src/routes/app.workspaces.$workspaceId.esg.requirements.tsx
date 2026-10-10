import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { EsgRequirementsPage } from '../pages/workspace/EsgCapPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/esg/requirements')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <EsgRequirementsPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
