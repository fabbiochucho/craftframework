import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { TermsPage } from '../pages/TermsPage'

export const Route = createFileRoute('/terms')({
  component: () => (
    <PublicLayout>
      <TermsPage />
    </PublicLayout>
  ),
})
