import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { InboxPage } from '../pages/InboxPage'

export const Route = createFileRoute('/inbox')({
  component: () => (
    <AppLayout>
      <InboxPage />
    </AppLayout>
  ),
})
