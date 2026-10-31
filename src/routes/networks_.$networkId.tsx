import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { NetworkDetailPage } from '../pages/NetworksPage'

export const Route = createFileRoute('/networks_/$networkId')({
  component: NetworkRoute,
})

function NetworkRoute() {
  const { networkId } = Route.useParams()
  return (
    <AppLayout>
      <NetworkDetailPage networkId={networkId} />
    </AppLayout>
  )
}
