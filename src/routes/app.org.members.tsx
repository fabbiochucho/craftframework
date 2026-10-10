import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { OrgMembersPage } from '../pages/workspace/OrgPages'

export const Route = createFileRoute('/app/org/members')({
  component: () => (
    <AppLayout>
      <OrgMembersPage />
    </AppLayout>
  ),
})
