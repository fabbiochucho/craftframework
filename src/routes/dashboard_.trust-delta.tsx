import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { TrustDeltaPage } from '../pages/TrustDeltaPage'

// /dashboard/trust-delta - flat sibling of /dashboard (trailing underscore on the
// segment opts out of nesting under the dashboard layout).
export const Route = createFileRoute('/dashboard_/trust-delta')({
  component: TrustDeltaRoute,
})

function TrustDeltaRoute() {
  return (
    <AppLayout>
      <TrustDeltaPage />
    </AppLayout>
  )
}
