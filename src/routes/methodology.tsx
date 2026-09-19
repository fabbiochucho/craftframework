import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { MethodologyPage } from '../pages/MethodologyPage'

export const Route = createFileRoute('/methodology')({
  component: () => (
    <PublicLayout>
      <MethodologyPage />
    </PublicLayout>
  ),
})
