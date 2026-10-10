import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { AssessmentDetailPage } from '../pages/workspace/GovernancePages'

export const Route = createFileRoute('/app/workspaces/$workspaceId/governance/assessments/$assessmentId/review')({
  component: () => {
    const { workspaceId, assessmentId } = Route.useParams()
    return (
      <AppLayout>
        <AssessmentDetailPage workspaceId={workspaceId} assessmentId={assessmentId} review />
      </AppLayout>
    )
  },
})
