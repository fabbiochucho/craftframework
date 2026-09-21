import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { PrivacyPage } from '../pages/PrivacyPage'

export const Route = createFileRoute('/privacy')({
  component: () => (
    <PublicLayout>
      <PrivacyPage />
    </PublicLayout>
  ),
})
