import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { RegulatoryCompliancePage } from '../pages/RegulatoryCompliancePage'

export const Route = createFileRoute('/regulatory-compliance')({
  component: () => (
    <AppLayout>
      <RegulatoryCompliancePage />
    </AppLayout>
  ),
})
