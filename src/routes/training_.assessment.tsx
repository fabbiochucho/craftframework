import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { TrainingAssessmentPage } from '../pages/TrainingAssessmentPage'

export const Route = createFileRoute('/training_/assessment')({
  component: () => (
    <AppLayout>
      <TrainingAssessmentPage />
    </AppLayout>
  ),
})
