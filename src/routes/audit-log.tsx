import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { AuditLogPage } from '../pages/AuditLogPage'

export const Route = createFileRoute('/audit-log')({
  component: () => (
    <AppLayout>
      <AuditLogPage />
    </AppLayout>
  ),
})
