import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { PreAssessmentPage } from '../pages/PreAssessmentPage'

export const Route = createFileRoute('/pre-assessment')({
  component: () => (
    <PublicLayout>
      <PreAssessmentPage />
    </PublicLayout>
  ),
})
