import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { NetworksPage } from '../pages/NetworksPage'

export const Route = createFileRoute('/networks')({
  component: () => (
    <AppLayout>
      <NetworksPage />
    </AppLayout>
  ),
})
