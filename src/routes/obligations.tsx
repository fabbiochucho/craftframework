import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { ObligationsPage } from '../pages/ObligationsPage'

export const Route = createFileRoute('/obligations')({
  component: () => (
    <AppLayout>
      <ObligationsPage />
    </AppLayout>
  ),
})
