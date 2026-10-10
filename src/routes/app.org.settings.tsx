import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { OrgSettingsPage } from '../pages/workspace/OrgPages'

export const Route = createFileRoute('/app/org/settings')({
  component: () => (
    <AppLayout>
      <OrgSettingsPage />
    </AppLayout>
  ),
})
