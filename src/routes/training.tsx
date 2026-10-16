import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { TrainingPage } from '../pages/TrainingPage'

export const Route = createFileRoute('/training')({
  component: () => (
    <AppLayout>
      <TrainingPage />
    </AppLayout>
  ),
})
