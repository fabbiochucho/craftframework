import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { AssessmentFrameworkPage } from '../pages/AssessmentFrameworkPage'

export const Route = createFileRoute('/assessment_/$frameworkId')({
  component: AssessmentFrameworkRoute,
})

function AssessmentFrameworkRoute() {
  const { frameworkId } = Route.useParams()
  return (
    <AppLayout>
      <AssessmentFrameworkPage frameworkId={frameworkId} />
    </AppLayout>
  )
}
