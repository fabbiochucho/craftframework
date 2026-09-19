import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { FrameworksPage } from '../pages/FrameworksPage'

export const Route = createFileRoute('/frameworks')({
  component: FrameworksRoute,
})

function FrameworksRoute() {
  return (
    <AppLayout>
      <FrameworksPage />
    </AppLayout>
  )
}
