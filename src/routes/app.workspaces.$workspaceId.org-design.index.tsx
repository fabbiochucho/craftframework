import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { OrgDesignListPage } from '../pages/workspace/OrgDesignPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/org-design/')({
  component: () => {
    const { workspaceId } = Route.useParams()
    return (
      <AppLayout>
        <OrgDesignListPage workspaceId={workspaceId} />
      </AppLayout>
    )
  },
})
