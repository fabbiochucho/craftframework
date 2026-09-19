import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { FindingsPage } from '../pages/FindingsPage'

export const Route = createFileRoute('/findings')({
  component: () => (
    <AppLayout>
      <FindingsPage />
    </AppLayout>
  ),
})
