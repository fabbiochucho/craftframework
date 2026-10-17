import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { AdminAnalyticsPage } from '../pages/AdminAnalyticsPage'

export const Route = createFileRoute('/admin_/analytics')({
  component: () => (
    <AppLayout>
      <AdminAnalyticsPage />
    </AppLayout>
  ),
})
