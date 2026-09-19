import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { UserGuidePage } from '../pages/UserGuidePage'

export const Route = createFileRoute('/guide')({
  component: () => (
    <AppLayout>
      <UserGuidePage />
    </AppLayout>
  ),
})
