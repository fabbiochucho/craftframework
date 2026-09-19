import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { InstitutePage } from '../pages/InstitutePage'

export const Route = createFileRoute('/institute')({
  component: () => (
    <PublicLayout>
      <InstitutePage />
    </PublicLayout>
  ),
})
