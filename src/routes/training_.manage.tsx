import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { TrainingManagePage } from '../pages/TrainingManagePage'

export const Route = createFileRoute('/training_/manage')({
  component: () => (
    <AppLayout>
      <TrainingManagePage />
    </AppLayout>
  ),
})
