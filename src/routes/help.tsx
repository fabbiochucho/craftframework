import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { HelpPage } from '../pages/HelpPage'

export const Route = createFileRoute('/help')({
  component: () => (
    <AppLayout>
      <HelpPage />
    </AppLayout>
  ),
})
