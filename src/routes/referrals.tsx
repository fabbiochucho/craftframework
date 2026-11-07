import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { ReferralsPage } from '../pages/ReferralsPage'

export const Route = createFileRoute('/referrals')({
  component: () => (
    <AppLayout>
      <ReferralsPage />
    </AppLayout>
  ),
})
