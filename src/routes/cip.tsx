import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { CIPPage } from '../pages/CIPPage'

export const Route = createFileRoute('/cip')({
  component: CIPRoute,
})

function CIPRoute() {
  return (
    <AppLayout>
      <CIPPage />
    </AppLayout>
  )
}
