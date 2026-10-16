import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { ValidationsPage } from '../pages/ValidationsPage'

export const Route = createFileRoute('/validations')({
  component: () => (
    <AppLayout>
      <ValidationsPage />
    </AppLayout>
  ),
})
