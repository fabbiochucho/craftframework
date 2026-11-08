import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { InvitationsPage } from '../pages/InvitationsPage'

export const Route = createFileRoute('/invitations')({
  component: () => (
    <AppLayout>
      <InvitationsPage />
    </AppLayout>
  ),
})
