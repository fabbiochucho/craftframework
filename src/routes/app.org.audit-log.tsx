import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { OrgAuditLogPage } from '../pages/workspace/OrgPages'

export const Route = createFileRoute('/app/org/audit-log')({
  component: () => (
    <AppLayout>
      <OrgAuditLogPage />
    </AppLayout>
  ),
})
