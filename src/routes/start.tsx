import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { StartPage } from '../pages/StartPage'

export const Route = createFileRoute('/start')({
  component: () => (
    <AppLayout>
      <StartPage />
    </AppLayout>
  ),
})
