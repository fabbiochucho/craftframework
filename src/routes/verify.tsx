import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { TrustDeltaPage } from '../pages/TrustDeltaPage'

export const Route = createFileRoute('/verify')({
  component: VerifyRoute,
})

function VerifyRoute() {
  return (
    <AppLayout>
      <TrustDeltaPage />
    </AppLayout>
  )
}
