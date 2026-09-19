import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { AssessmentPage } from '../pages/AssessmentPage'

export const Route = createFileRoute('/assessment')({
  component: AssessmentRoute,
})

function AssessmentRoute() {
  return (
    <AppLayout>
      <AssessmentPage />
    </AppLayout>
  )
}
