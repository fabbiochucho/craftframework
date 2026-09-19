import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { LandingPage } from '../pages/LandingPage'

export const Route = createFileRoute('/')({
  component: () => (
    <PublicLayout>
      <LandingPage />
    </PublicLayout>
  ),
})
