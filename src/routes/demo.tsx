import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { DemoPage } from '../pages/DemoPage'

export const Route = createFileRoute('/demo')({
  component: () => (
    <PublicLayout>
      <DemoPage />
    </PublicLayout>
  ),
})
