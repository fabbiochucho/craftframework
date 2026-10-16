import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { EngagementsPage } from '../pages/EngagementsPage'

export const Route = createFileRoute('/engagements')({
  component: () => (
    <AppLayout>
      <EngagementsPage />
    </AppLayout>
  ),
})
