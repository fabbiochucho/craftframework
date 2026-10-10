import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { WorkspacesPage } from '../pages/workspace/OrgPages'

export const Route = createFileRoute('/app/workspaces/')({
  component: () => (
    <AppLayout>
      <WorkspacesPage />
    </AppLayout>
  ),
})
