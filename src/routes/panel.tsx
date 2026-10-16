import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { ReviewPanelPage } from '../pages/ReviewPanelPage'

export const Route = createFileRoute('/panel')({
  component: () => (
    <AppLayout>
      <ReviewPanelPage />
    </AppLayout>
  ),
})
