import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { NetworkBriefPage } from '../pages/NetworkBriefPage'

export const Route = createFileRoute('/networks_/$networkId_/brief/$roundId')({
  component: BriefRoute,
})

function BriefRoute() {
  const { networkId, roundId } = Route.useParams()
  return (
    <AppLayout>
      <NetworkBriefPage networkId={networkId} roundId={roundId} />
    </AppLayout>
  )
}
