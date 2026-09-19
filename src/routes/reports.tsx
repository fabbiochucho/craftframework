import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { ReportsPage } from '../pages/ReportsPage'

export const Route = createFileRoute('/reports')({
  component: () => (
    <AppLayout>
      <ReportsPage />
    </AppLayout>
  ),
})
