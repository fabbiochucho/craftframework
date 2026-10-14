import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { OrgDesignPage } from '../pages/workspace/OrgDesignPages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/org-design/$reviewId')({
  component: () => {
    const { workspaceId, reviewId } = Route.useParams()
    return (
      <AppLayout>
        <OrgDesignPage workspaceId={workspaceId} reviewId={reviewId} />
      </AppLayout>
    )
  },
})
