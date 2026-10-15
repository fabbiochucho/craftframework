import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { SecurityPage } from '../pages/workspace/SecurityPage'

export const Route = createFileRoute('/app/security')({
  component: () => (
    <AppLayout>
      <SecurityPage />
    </AppLayout>
  ),
})
