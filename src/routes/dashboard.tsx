import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { DashboardPage } from '../pages/DashboardPage'

export const Route = createFileRoute('/dashboard')({
  component: DashboardRoute,
})

function DashboardRoute() {
  return (
    <AppLayout>
      <DashboardPage />
    </AppLayout>
  )
}
