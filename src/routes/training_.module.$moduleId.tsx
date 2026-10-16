import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { TrainingModulePage } from '../pages/TrainingModulePage'

export const Route = createFileRoute('/training_/module/$moduleId')({
  component: TrainingModuleRoute,
})

function TrainingModuleRoute() {
  const { moduleId } = Route.useParams()
  return (
    <AppLayout>
      <TrainingModulePage moduleId={moduleId} />
    </AppLayout>
  )
}
