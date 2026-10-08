import { createFileRoute } from '@tanstack/react-router'
import { PublicLayout } from '../components/PublicLayout'
import { ArchitecturePage } from '../pages/ArchitecturePage'

export const Route = createFileRoute('/architecture')({
  component: () => (
    <PublicLayout>
      <ArchitecturePage />
    </PublicLayout>
  ),
})
