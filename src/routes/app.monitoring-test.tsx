import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { MonitoringTestPage } from '../pages/MonitoringTestPage'

export const Route = createFileRoute('/app/monitoring-test')({
  component: () => (
    <AppLayout>
      <MonitoringTestPage />
    </AppLayout>
  ),
})
