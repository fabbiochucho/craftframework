import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { CodeOfConductPage } from '../pages/CodeOfConductPage'

export const Route = createFileRoute('/code-of-conduct')({
  component: () => (
    <PublicLayout>
      <CodeOfConductPage />
    </PublicLayout>
  ),
})
