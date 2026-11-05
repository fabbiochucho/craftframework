import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { CapacityAssessmentPage } from '../pages/CapacityAssessmentPage'

export const Route = createFileRoute('/capacity')({
  component: () => (
    <AppLayout>
      <CapacityAssessmentPage />
    </AppLayout>
  ),
})
