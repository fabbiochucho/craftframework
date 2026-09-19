import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { OpenSourcePage } from '../pages/OpenSourcePage'

export const Route = createFileRoute('/open-source')({
  component: () => (
    <PublicLayout>
      <OpenSourcePage />
    </PublicLayout>
  ),
})
