import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { AwardsPage } from '../pages/AwardsPage'

export const Route = createFileRoute('/awards')({
  component: () => (
    <AppLayout>
      <AwardsPage />
    </AppLayout>
  ),
})
