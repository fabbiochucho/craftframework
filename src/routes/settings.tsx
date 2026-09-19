import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '../components/AppLayout'
import { SettingsPage } from '../pages/SettingsPage'

export const Route = createFileRoute('/settings')({
  component: () => (
    <AppLayout>
      <SettingsPage />
    </AppLayout>
  ),
})
