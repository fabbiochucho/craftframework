import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { RiskQuantPage } from '../pages/RiskQuantPage'

export const Route = createFileRoute('/risk')({
  component: RiskRoute,
})

function RiskRoute() {
  return (
    <AppLayout>
      <RiskQuantPage />
    </AppLayout>
  )
}
